import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Shield, Loader2, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
  totp_code: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [requires2fa, setRequires2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'admin@communityfinance.id', password: 'password123' },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authAPI.login(data);

      if (res.requires_2fa) {
        setRequires2fa(true);
        toast('Masukkan kode 2FA dari aplikasi authenticator Anda', { icon: '🔐' });
        return;
      }

      setAuth(res.user, res.accessToken, res.refreshToken);
      toast.success(`Selamat datang, ${res.user.full_name}!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1 lg:hidden">
          <Shield size={20} className="text-brand-400" />
          <span className="font-display font-bold text-lg text-slate-100">CommunityFinance</span>
        </div>
        <h2 className="font-display text-3xl font-bold text-slate-100 mb-2">Masuk ke akun</h2>
        <p className="text-slate-400 text-sm">
          Belum punya akun?{' '}
          <Link to="/auth/register" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
            Daftar sekarang
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              {...register('email')}
              type="email"
              placeholder="nama@email.com"
              className="input-field pl-10"
            />
          </div>
          {errors.email && <p className="text-rose-400 text-xs mt-1">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="input-field pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-rose-400 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {/* 2FA Code */}
        {requires2fa && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <label className="label">Kode 2FA</label>
            <input
              {...register('totp_code')}
              type="text"
              placeholder="000000"
              maxLength={6}
              className="input-field text-center font-mono text-xl tracking-widest"
              autoFocus
            />
          </motion.div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary justify-center py-3 text-base mt-2"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Memproses...</>
          ) : (
            requires2fa ? 'Verifikasi 2FA' : 'Masuk'
          )}
        </button>
      </form>

      {/* Demo hint */}
      <div className="mt-6 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
        <p className="text-xs text-brand-300 text-center">
          <span className="font-medium">Demo:</span> admin@communityfinance.id / password123
        </p>
      </div>
    </div>
  );
}
