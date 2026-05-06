'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signup } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      const session = await signup(data.email, data.password);
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.token }),
      });
      toast.success('Account created!');
      router.push('/dashboard');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Signup failed';
      setServerError(msg);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            PS
          </div>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Start managing your review prompts</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="signup-form">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" placeholder="8+ characters" {...register('password')} />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>
            {serverError && (
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
            )}
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
