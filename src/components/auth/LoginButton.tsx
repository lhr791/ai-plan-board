'use client'

import { createClient } from '@/lib/supabase/client'
import { Github } from 'lucide-react'

export default function LoginButton() {
    const supabase = createClient()

    const handleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            }
        })
    }

    return (
        <button
            onClick={handleLogin}
            className="flex items-center gap-2 bg-[#2ea043] text-white px-4 py-2 rounded font-bold hover:bg-[#2c974b] transition-colors shadow-[0_0_15px_rgba(46,160,67,0.4)]"
        >
            <Github size={20} />
            GitHub 登录以协作
        </button>
    )
}
