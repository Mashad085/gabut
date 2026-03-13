// RegisterPage
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Mail, Lock, User, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  full_name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  username: z.string().min(3, 'Username minimal 3 karakter').regex(/^[a-zA-Z0-9_]+$/, 'Hanya huruf, angka, underscore'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authAPI.register(data);
      setAuth(res.user, res.accessToken, res.refreshToken);
      toast.success('Akun berhasil dibuat!');
      navigate('/');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Pendaftaran gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold text-slate-100 mb-2">Buat akun baru</h2>
        <p className="text-slate-400 text-sm">
          Sudah punya akun?{' '}
          <Link to="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium">Masuk</Link>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {[
          { name: 'full_name', label: 'Nama Lengkap', type: 'text', icon: User, placeholder: 'Nama lengkap Anda' },
          { name: 'email', label: 'Email', type: 'email', icon: Mail, placeholder: 'nama@email.com' },
          { name: 'username', label: 'Username', type: 'text', icon: User, placeholder: 'username_anda' },
          { name: 'phone', label: 'Nomor HP (opsional)', type: 'tel', icon: Phone, placeholder: '+62 xxx xxxx xxxx' },
        ].map(field => (
          <div key={field.name}>
            <label className="label">{field.label}</label>
            <div className="relative">
              <field.icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input {...register(field.name as any)} type={field.type} placeholder={field.placeholder} className="input-field pl-10" />
            </div>
            {(errors as any)[field.name] && <p className="text-rose-400 text-xs mt-1">{(errors as any)[field.name].message}</p>}
          </div>
        ))}

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="Min. 8 karakter" className="input-field pl-10 pr-10" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-rose-400 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={loading} className="w-full btn-primary justify-center py-3 text-base mt-2">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Membuat akun...</> : 'Daftar Sekarang'}
        </button>
      </form>
    </div>
  );
}
