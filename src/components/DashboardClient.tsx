'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
    addSection, updateSection, deleteSection,
    addTask, updateTask, deleteTask,
    addPlan, updatePlan, deletePlan,
    importDataBatch
} from '@/app/actions'

type Plan = {
    id: string
    desc: string
    is_completed: boolean
}

type Task = {
    id: string
    title: string
    badge: string
    desc: string
    progress: number
    plans: Plan[]
}

type Section = {
    id: string
    title: string
    tasks: Task[]
}

export default function DashboardClient({ initialData }: { initialData: Section[] }) {
    const [data, setData] = useState<Section[]>(initialData)
    const [isImporting, setIsImporting] = useState(false)
    const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Modal State
    const [modalOpen, setModalOpen] = useState(false)
    const [activeTask, setActiveTask] = useState<{ sectionId: string, taskId: string } | null>(null)
    const [newPlanDesc, setNewPlanDesc] = useState('')

    // Check LocalStorage for import on mount
    useEffect(() => {
        if (initialData.length === 0) {
            const localData = localStorage.getItem('aiBuilderData_v3')
            if (localData) {
                if (confirm('检测到本地浏览器存有离线看板数据，是否立即同步上云保护并替换当前空看板？')) {
                    handleImportData(JSON.parse(localData))
                }
            }
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleImportData = async (localData: any[]) => {
        setIsImporting(true)
        await importDataBatch(localData)
        setIsImporting(false)
        // Clear local storage to prevent prompt again
        localStorage.removeItem('aiBuilderData_v3')
        localStorage.removeItem('aiBuilderData_v2')
        localStorage.removeItem('aiBuilderData')
        window.location.reload()
    }

    const { overallProgress, totalTasks } = useMemo(() => {
        let tProg = 0, tCount = 0
        data.forEach(s => {
            s.tasks.forEach(t => {
                tProg += t.progress || 0
                tCount++
            })
        })
        return {
            overallProgress: tCount === 0 ? 0 : Math.round(tProg / tCount),
            totalTasks: tCount
        }
    }, [data])

    // Helpers to mutate local state instantly (Optimistic UI)
    const mutData = (updater: (prev: Section[]) => Section[]) => {
        setData(prev => updater(prev))
    }

    const runSync = async (action: () => Promise<any>) => {
        setSyncStatus('saving')
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
        try {
            await action()
            setSyncStatus('saved')
            syncTimeoutRef.current = setTimeout(() => setSyncStatus('idle'), 2000)
        } catch (e) {
            console.error('Sync failed', e)
            setSyncStatus('idle')
            alert('保存失败，请检查网络连接')
        }
    }

    // ==== ACTIONS ====

    const onAddSection = async () => {
        mutData(prev => [...prev, { id: 'temp_' + Date.now(), title: '新板块', tasks: [] }])
        runSync(() => addSection('新板块'))
    }

    const onDeleteSection = async (id: string) => {
        if (confirm('确定要删除这个板块及其包含的所有任务吗？')) {
            mutData(prev => prev.filter(s => s.id !== id))
            if (!id.startsWith('temp_')) runSync(() => deleteSection(id))
        }
    }

    const onUpdateSectionTitle = (id: string, newTitle: string) => {
        const trimmed = newTitle.trim()
        const section = data.find(s => s.id === id)
        if (section && section.title !== trimmed) {
            mutData(prev => prev.map(s => s.id === id ? { ...s, title: trimmed } : s))
            if (!id.startsWith('temp_')) runSync(() => updateSection(id, trimmed))
        }
    }

    const onAddTask = async (sectionId: string) => {
        mutData(prev => prev.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    tasks: [...s.tasks, { id: 'temp_' + Date.now(), title: '新任务', badge: '标签', desc: '', progress: 0, plans: [] }]
                }
            }
            return s
        }))
        if (!sectionId.startsWith('temp_')) runSync(() => addTask(sectionId))
    }

    const onDeleteTask = async (sectionId: string, taskId: string) => {
        mutData(prev => prev.map(s => {
            if (s.id === sectionId) return { ...s, tasks: s.tasks.filter(t => t.id !== taskId) }
            return s
        }))
        if (!taskId.startsWith('temp_')) runSync(() => deleteTask(taskId))
    }

    const onUpdateTask = (sectionId: string, taskId: string, key: keyof Task, val: string) => {
        const trimmed = val.trim()
        const section = data.find(s => s.id === sectionId)
        const task = section?.tasks.find(t => t.id === taskId)
        if (task && task[key] !== trimmed) {
            mutData(prev => prev.map(s => s.id === sectionId ? {
                ...s,
                tasks: s.tasks.map(t => t.id === taskId ? { ...t, [key]: trimmed } : t)
            } : s))
            if (!taskId.startsWith('temp_')) runSync(() => updateTask(taskId, { [key]: trimmed }))
        }
    }

    // ==== MODAL PLANS ====
    const currentTask = useMemo(() => {
        if (!activeTask) return null
        return data.find(s => s.id === activeTask.sectionId)?.tasks.find(t => t.id === activeTask.taskId) || null
    }, [activeTask, data])

    const onAddPlan = async () => {
        const trimmed = newPlanDesc.trim()
        if (!trimmed || !activeTask || !currentTask) return

        // We can't optimistically assign UUID reliably, so we let server handle it fully, or use a temp ID.
        // To ensure fast UI, we assign temp ID and trigger server fetch.
        const tempId = 'temp_' + Date.now()

        mutData(prev => prev.map(s => s.id === activeTask.sectionId ? {
            ...s,
            tasks: s.tasks.map(t => {
                if (t.id === activeTask.taskId) {
                    const newPlans = [...t.plans, { id: tempId, desc: trimmed, is_completed: false }]
                    return { ...t, plans: newPlans, progress: computeProgress(newPlans) }
                }
                return t
            })
        } : s))

        setNewPlanDesc('')

        if (!activeTask.taskId.startsWith('temp_')) {
            runSync(() => addPlan(activeTask.taskId, trimmed))
            // the real ID is updated when user refreshes or we wait for polling.
        }
    }

    const onTogglePlan = async (planId: string, currentCompleted: boolean) => {
        if (!activeTask || !currentTask) return
        const newState = !currentCompleted

        mutData(prev => prev.map(s => s.id === activeTask.sectionId ? {
            ...s,
            tasks: s.tasks.map(t => {
                if (t.id === activeTask.taskId) {
                    const newPlans = t.plans.map(p => p.id === planId ? { ...p, is_completed: newState } : p)
                    return { ...t, plans: newPlans, progress: computeProgress(newPlans) }
                }
                return t
            })
        } : s))

        if (!planId.startsWith('temp_')) {
            runSync(() => updatePlan(planId, { is_completed: newState }))
        }
    }

    const onUpdatePlanDesc = (planId: string, newVal: string) => {
        if (!activeTask) return
        const trimmed = newVal.trim()
        mutData(prev => prev.map(s => s.id === activeTask.sectionId ? {
            ...s,
            tasks: s.tasks.map(t => {
                if (t.id === activeTask.taskId) {
                    return { ...t, plans: t.plans.map(p => p.id === planId ? { ...p, desc: trimmed } : p) }
                }
                return t
            })
        } : s))
        if (!planId.startsWith('temp_')) runSync(() => updatePlan(planId, { desc: trimmed }))
    }

    const onDeletePlan = async (planId: string) => {
        if (!activeTask || !currentTask) return
        mutData(prev => prev.map(s => s.id === activeTask.sectionId ? {
            ...s,
            tasks: s.tasks.map(t => {
                if (t.id === activeTask.taskId) {
                    const newPlans = t.plans.filter(p => p.id !== planId)
                    return { ...t, plans: newPlans, progress: computeProgress(newPlans) }
                }
                return t
            })
        } : s))
        if (!planId.startsWith('temp_')) runSync(() => deletePlan(planId))
    }

    const computeProgress = (plans: Plan[]) => {
        if (plans.length === 0) return 0
        const count = plans.filter(p => p.is_completed).length
        return Math.round((count / plans.length) * 100)
    }

    // --- Editable Span Component to avoid focus loss bugs ---
    const EditableSpan = ({ val, onSave, placeholder, className, as = 'div' }: any) => {
        const Tag = as
        const elRef = useRef<HTMLElement>(null)

        const handleBlur = () => {
            if (elRef.current) {
                onSave(elRef.current.innerText)
            }
        }

        // Dangerously Set Inner HTML only once on mount or when externally forced
        return (
            <Tag
                ref={elRef}
                className={className}
                contentEditable={true}
                suppressContentEditableWarning={true}
                onBlur={handleBlur}
                data-placeholder={placeholder}
            >
                {val}
            </Tag>
        )
    }

    if (isImporting) {
        return <div className="text-center py-20 animate-pulse text-blue-400">正在从浏览器本地将您的数据安全同步到云端数据库，请稍候...</div>
    }

    return (
        <>
            {/* Global Toolbar */}
            <div className="flex justify-end mb-4">
                <button onClick={onAddSection} className="bg-[#58a6ff] hover:bg-[#318bf8] text-[#000] font-bold py-2 px-4 rounded-md shadow-[0_0_15px_rgba(88,166,255,0.4)] transition-all transform hover:-translate-y-0.5">
                    + 添加新板块
                </button>
            </div>

            {/* Progress Card */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-8 shadow-lg shadow-black/50">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold m-0 text-white">全局完成度</h2>
                    <div className="flex items-center gap-2 text-sm px-2 py-1 bg-[#21262d] rounded text-[#8b949e] transition-colors duration-300">
                        {syncStatus === 'saving' && (
                            <span className="flex items-center gap-1.5 text-[#58a6ff] animate-pulse">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                保存中...
                            </span>
                        )}
                        {syncStatus === 'saved' && (
                            <span className="flex items-center gap-1.5 text-[#3fb950]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                已保存至云端
                            </span>
                        )}
                        {syncStatus === 'idle' && (
                            <span>云端实时同步开启 🟢</span>
                        )}
                    </div>
                </div>
                <div className="text-sm text-[#8b949e] mb-4">进度由各任务的“子计划”完成比例自动计算得出。</div>
                <div className="w-full h-6 bg-[#21262d] rounded-full overflow-hidden relative">
                    <div
                        className="h-full bg-gradient-to-r from-[#1f6feb] to-[#58a6ff] transition-all duration-500 ease-out"
                        style={{ width: `${overallProgress}%` }}
                    />
                    <div className="absolute top-0 right-3 leading-6 font-bold text-sm text-white drop-shadow-md">
                        {overallProgress}%
                    </div>
                </div>
            </div>

            {/* Masonry Layout */}
            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                {data.map(section => (
                    <div key={section.id} className="break-inside-avoid bg-[#161b22] border border-[#30363d] rounded-xl p-6 hover:border-[#58a6ff] hover:shadow-[0_8px_25px_rgba(88,166,255,0.4)] transition-all duration-300 relative group">

                        <div className="flex justify-between items-start border-b border-[#30363d] pb-3 mb-5">
                            <EditableSpan
                                as="h2"
                                val={section.title}
                                onSave={(v: string) => onUpdateSectionTitle(section.id, v)}
                                placeholder="输入板块名称"
                                className="text-xl text-[#58a6ff] flex-grow outline-none focus:bg-white/10 rounded px-1 transition-colors hover:border-dashed hover:border-[#8b949e] border border-transparent mr-2"
                            />
                            <button
                                onClick={() => onDeleteSection(section.id)}
                                className="opacity-0 group-hover:opacity-100 bg-transparent text-[#f85149] border border-[#f85149] hover:bg-[#f85149]/10 px-2 py-1 rounded text-xs transition duration-200"
                            >
                                删除版块
                            </button>
                        </div>

                        <div className="space-y-4">
                            {section.tasks.map(task => (
                                <div key={task.id} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 relative">

                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <EditableSpan
                                            val={task.title}
                                            onSave={(v: string) => onUpdateTask(section.id, task.id, 'title', v)}
                                            placeholder="任务名称"
                                            className="font-bold text-[1.05rem] outline-none flex-grow focus:bg-white/10 rounded px-1 transition-colors hover:border-dashed hover:border-[#8b949e] border border-transparent"
                                        />
                                        <div className="flex gap-2 items-center shrink-0">
                                            <button onClick={() => onDeleteTask(section.id, task.id)} className="text-[#f85149] opacity-50 hover:opacity-100 font-black px-1" title="删除">×</button>
                                        </div>
                                    </div>

                                    {/* Task Footer */}
                                    <div className="flex justify-between items-center mt-4">
                                        <button
                                            onClick={() => {
                                                setActiveTask({ sectionId: section.id, taskId: task.id })
                                                setModalOpen(true)
                                            }}
                                            className="bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff] px-3 py-1.5 rounded-md text-sm hover:bg-[#58a6ff] hover:text-black hover:shadow-[0_0_10px_rgba(88,166,255,0.4)] transition-all flex items-center gap-1.5 whitespace-nowrap"
                                        >
                                            ☰ Plan ({task.plans?.length || 0})
                                        </button>

                                        <div className="flex items-center gap-2.5 ml-4 flex-grow">
                                            <div className="flex-grow h-1.5 bg-[#30363d] rounded-full overflow-hidden">
                                                <div className="h-full bg-[#58a6ff] transition-all duration-300" style={{ width: `${task.progress}%` }} />
                                            </div>
                                            <div className="font-mono text-[#8b949e] text-sm w-8 text-right shrink-0">
                                                {task.progress}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => onAddTask(section.id)}
                            className="w-full mt-4 p-2.5 rounded-lg border border-dashed border-[#8b949e] text-[#8b949e] bg-transparent hover:border-[#58a6ff] hover:text-[#58a6ff] transition-colors"
                        >
                            + 新增任务
                        </button>
                    </div>
                ))}
            </div>

            {/* PLAN MODAL */}
            {modalOpen && currentTask && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
                    <div className="bg-[#161b22] w-full max-w-[550px] border border-[#30363d] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-[#30363d] flex justify-between items-center">
                            <h3 className="text-xl font-bold truncate pr-4 text-white">[{currentTask.title}] - 子计划</h3>
                            <button onClick={() => setModalOpen(false)} className="text-[#8b949e] hover:text-white text-2xl leading-none transition-colors">&times;</button>
                        </div>

                        <div className="p-6">
                            <div className="text-sm text-[#8b949e] mb-4">
                                {currentTask.plans.filter(p => p.is_completed).length} / {currentTask.plans.length} 已完成 ({currentTask.progress}%)
                            </div>

                            <div className="max-h-[40vh] overflow-y-auto pr-2 space-y-2.5 mb-6 scrollbar-thin scrollbar-thumb-[#30363d] scrollbar-track-transparent">
                                {currentTask.plans.map(plan => (
                                    <div key={plan.id} className={`flex items-start gap-3 bg-[#0d1117] p-3 rounded-lg border transition-colors ${plan.is_completed ? 'border-[#30363d] bg-[#111418] opacity-60' : 'border-[#21262d] hover:border-[#30363d]'}`}>
                                        <input
                                            type="checkbox"
                                            checked={plan.is_completed}
                                            onChange={() => onTogglePlan(plan.id, plan.is_completed)}
                                            className="mt-1 w-[18px] h-[18px] cursor-pointer accent-[#58a6ff] shrink-0"
                                        />
                                        <EditableSpan
                                            as="span"
                                            val={plan.desc}
                                            onSave={(v: string) => onUpdatePlanDesc(plan.id, v)}
                                            placeholder="计划详情..."
                                            className={`flex-grow outline-none leading-relaxed px-1 rounded focus:bg-white/10 ${plan.is_completed ? 'line-through text-[#8b949e]' : 'text-[#e6edf3]'}`}
                                        />
                                        <button
                                            onClick={() => onDeletePlan(plan.id)}
                                            className="text-[#f85149] hover:bg-[#f85149] hover:text-white shrink-0 w-6 h-6 rounded flex items-center justify-center font-bold text-sm transition-colors border border-transparent hover:border-[#f85149]"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newPlanDesc}
                                    onChange={e => setNewPlanDesc(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') onAddPlan() }}
                                    placeholder="输入新计划并回车..."
                                    className="flex-grow bg-[#0d1117] border border-[#30363d] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]"
                                />
                                <button
                                    onClick={onAddPlan}
                                    className="bg-[#58a6ff] text-black font-bold px-5 py-2.5 rounded-lg hover:bg-[#318bf8] transition-colors"
                                >
                                    添加
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
