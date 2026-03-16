import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const result = await api.forgotPassword(email.trim());
      setMessage(result?.message || 'If an account exists for this email, a reset link has been sent.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to process request. Please try again.';
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
          <h1 className="font-display text-3xl font-bold text-white">Forgot Password</h1>
          <p className="text-neutral-400 mt-2">Enter your email to receive a reset link</p>
        </div>

        <div className="card p-8 shadow-elevated animate-scale-in">
          <h2 className="text-xl font-semibold text-neutral-900 mb-6">Reset your password</h2>

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'Sending reset link...' : 'Send Reset Link'}
            </button>
          </form>

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
