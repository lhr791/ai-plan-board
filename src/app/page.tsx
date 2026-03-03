import { getDashboardData } from '@/app/actions'
import DashboardClient from '@/components/DashboardClient'
import LoginButton from '@/components/auth/LoginButton'
import LogoutButton from '@/components/auth/LogoutButton'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const dashboardData = await getDashboardData()

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] p-8">
      <div className="max-w-[1200px] mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-[#58a6ff] drop-shadow-[0_0_15px_rgba(88,166,255,0.4)]">
            🚀 AI 施工计划动态大纲
          </h1>
          <div>
            {!user ? (
              <LoginButton />
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-[#8b949e]">已登录: {user.email || 'GitHub 用户'}</span>
                <LogoutButton />
              </div>
            )}
          </div>
        </header>

        {user ? (
          <DashboardClient initialData={dashboardData || []} />
        ) : (
          <div className="text-center py-20 bg-[#161b22] border border-[#30363d] rounded-xl">
            <h2 className="text-2xl mb-4">请登录以访问和编辑您的专属看板</h2>
            <p className="text-[#8b949e] mb-8">数据通过强隔离的 RLS 安全保存在云端。</p>
            <div className="flex justify-center">
              <LoginButton />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
