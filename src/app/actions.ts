'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Note: the tables are named 'ai_plan_sections', 'ai_plan_tasks', 'ai_plan_items'
export async function getDashboardData() {
    const supabase = await createClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user || authErr) return null

    const { data: sections, error } = await supabase
        .from('ai_plan_sections')
        .select(`
      *,
      tasks:ai_plan_tasks(
        *,
        plans:ai_plan_items(*)
      )
    `)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

    // Sort nested arrays
    const getSort = (val: any) => (val === null || val === undefined) ? Infinity : val

    sections?.forEach((s: any) => {
        s.tasks.sort((a: any, b: any) => {
            const orderA = getSort(a.sort_order)
            const orderB = getSort(b.sort_order)
            if (orderA !== orderB) return orderA - orderB
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
        s.tasks.forEach((t: any) => {
            t.plans.sort((a: any, b: any) => {
                const orderA = getSort(a.sort_order)
                const orderB = getSort(b.sort_order)
                if (orderA !== orderB) return orderA - orderB
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            })
            // Calculate progress
            if (t.plans.length === 0) t.progress = 0
            else {
                const completedCount = t.plans.filter((p: any) => p.is_completed).length
                t.progress = Math.round((completedCount / t.plans.length) * 100)
            }
        })
    })

    return sections || []
}

export async function addSection(title: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('ai_plan_sections').insert({ title, user_id: user.id })
    revalidatePath('/')
}

export async function updateSection(id: string, title: string) {
    const supabase = await createClient()
    await supabase.from('ai_plan_sections').update({ title }).eq('id', id)
    revalidatePath('/')
}

export async function deleteSection(id: string) {
    const supabase = await createClient()
    await supabase.from('ai_plan_sections').delete().eq('id', id)
    revalidatePath('/')
}

export async function addTask(sectionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('ai_plan_tasks').insert({
        section_id: sectionId,
        user_id: user.id,
        title: '新任务',
        badge: '标签',
        desc: ''
    })
    revalidatePath('/')
}

export async function updateTask(id: string, updates: { title?: string, badge?: string, desc?: string }) {
    const supabase = await createClient()
    await supabase.from('ai_plan_tasks').update(updates).eq('id', id)
    revalidatePath('/')
}

export async function deleteTask(id: string) {
    const supabase = await createClient()
    await supabase.from('ai_plan_tasks').delete().eq('id', id)
    revalidatePath('/')
}

export async function addPlan(taskId: string, desc: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('ai_plan_items').insert({
        task_id: taskId,
        user_id: user.id,
        desc
    })
    revalidatePath('/')
}

export async function updatePlan(id: string, updates: { desc?: string, is_completed?: boolean }) {
    const supabase = await createClient()
    await supabase.from('ai_plan_items').update(updates).eq('id', id)
    revalidatePath('/')
}

export async function deletePlan(id: string) {
    const supabase = await createClient()
    await supabase.from('ai_plan_items').delete().eq('id', id)
    revalidatePath('/')
}

export async function importDataBatch(localData: any[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // We should do this relatively carefully. Just insert nested. Default order is fine.
    for (let sIdx = 0; sIdx < localData.length; sIdx++) {
        const s = localData[sIdx]
        const { data: secData, error: secErr } = await supabase.from('ai_plan_sections').insert({
            title: s.title,
            user_id: user.id,
            sort_order: sIdx
        }).select().single()

        if (!secErr && secData) {
            if (s.tasks && Array.isArray(s.tasks)) {
                for (let tIdx = 0; tIdx < s.tasks.length; tIdx++) {
                    const t = s.tasks[tIdx]
                    const { data: taskData, error: taskErr } = await supabase.from('ai_plan_tasks').insert({
                        section_id: secData.id,
                        user_id: user.id,
                        title: t.title,
                        badge: t.badge,
                        desc: t.desc || '',
                        sort_order: tIdx
                    }).select().single()

                    if (!taskErr && taskData && t.plans && Array.isArray(t.plans)) {
                        for (let pIdx = 0; pIdx < t.plans.length; pIdx++) {
                            const p = t.plans[pIdx]
                            await supabase.from('ai_plan_items').insert({
                                task_id: taskData.id,
                                user_id: user.id,
                                desc: p.desc,
                                is_completed: p.completed,
                                sort_order: pIdx
                            })
                        }
                    }
                }
            }
        }
    }

    revalidatePath('/')
    return true
}
