'use client'

import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
    const supabase = createClient()
    const router = useRouter()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.refresh()
    }

    return (
        <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-transparent text-[#f85149] border border-[#f85149] px-3 py-1.5 rounded text-sm hover:bg-[rgba(248,81,73,0.1)] transition-colors"
        >
            <LogOut size={16} />
            退出登录
        </button>
    )
}
