import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [validating, setValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const validateToken = async () => {
      if (!token) {
        if (!mounted) return;
        setIsValidToken(false);
        setError('Reset link is invalid or missing token.');
        setValidating(false);
        return;
      }

      try {
        const result = await api.validateResetToken(token);
        if (!mounted) return;
        setIsValidToken(Boolean(result?.valid));
        if (!result?.valid) {
          setError(result?.message || 'Reset link is invalid or expired.');
        }
      } catch (err: unknown) {
        if (!mounted) return;
        setIsValidToken(false);
        const msg = err instanceof Error ? err.message : 'Unable to validate reset link.';
        setError(msg);
      } finally {
        if (mounted) setValidating(false);
      }
    };

    validateToken();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.resetPassword(token, newPassword, confirmPassword);
      setMessage(result?.message || 'Password has been reset successfully.');
      setIsValidToken(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reset password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 25%, rgba(12, 141, 230, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(249, 115, 22, 0.1) 0%, transparent 50%)',
          }}
        />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-elevated mb-4">
            <span className="font-display font-bold text-3xl text-white">AK</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Reset Password</h1>
          <p className="text-neutral-400 mt-2">Create a new password for your account</p>
        </div>

        <div className="card p-8 shadow-elevated animate-scale-in">
          <h2 className="text-xl font-semibold text-neutral-900 mb-6">Set a new password</h2>

          {validating && (
            <p className="text-sm text-neutral-600 mb-4">Validating reset link...</p>
          )}

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-success-50 border border-success-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-success-700">{message}</p>
            </div>
          )}

          {!validating && isValidToken && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input pl-10"
                    placeholder="Enter new password"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input pl-10"
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                {loading ? 'Resetting password...' : 'Reset Password'}
              </button>
            </form>
          )}

          <Link
            to="/login"
            className="mt-5 inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>

        <p className="text-center text-neutral-500 text-sm mt-6">© 2024 AK Success Sdn Bhd. All rights reserved.</p>
      </div>
    </div>
  );
}
