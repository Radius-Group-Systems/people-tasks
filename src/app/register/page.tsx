"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { RadiusWordmark, RadiusGlowArc } from "@/components/radius-brand";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto-sign in after registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/onboarding",
      });

      if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#252525] relative overflow-hidden">
      {/* Glow arc decorations */}
      <RadiusGlowArc opacity={0.1} size={800} delay={0} />
      <RadiusGlowArc opacity={0.07} size={550} delay={200} />

      <div
        className="relative z-10 w-full max-w-sm mx-4"
        style={{ animation: "radius-fade-up 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 300ms both" }}
      >
        {/* Brand header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <RadiusWordmark
              subBrand="GROUP"
              variant="stack"
              colorMode="light"
              size="lg"
            />
          </div>
          <p className="text-[#91918B] text-sm tracking-wide">
            Create your account
          </p>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm border"
            style={{
              backgroundColor: "rgba(155, 44, 44, 0.1)",
              borderColor: "rgba(155, 44, 44, 0.2)",
              color: "#E57373",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="name" className="text-xs font-medium text-[#91918B] uppercase tracking-widest">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[#2E2E2E] border border-[#363636] rounded-lg text-sm text-white placeholder:text-[#6B6B66] focus:outline-none focus:border-[#91918B] focus:ring-1 focus:ring-[#91918B]/30 transition-all duration-200"
              placeholder="Your name"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-medium text-[#91918B] uppercase tracking-widest">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#2E2E2E] border border-[#363636] rounded-lg text-sm text-white placeholder:text-[#6B6B66] focus:outline-none focus:border-[#91918B] focus:ring-1 focus:ring-[#91918B]/30 transition-all duration-200"
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium text-[#91918B] uppercase tracking-widest">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#2E2E2E] border border-[#363636] rounded-lg text-sm text-white placeholder:text-[#6B6B66] focus:outline-none focus:border-[#91918B] focus:ring-1 focus:ring-[#91918B]/30 transition-all duration-200"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-white text-[#252525] rounded-lg text-sm font-semibold hover:bg-[#F5F5F4] active:scale-[0.98] disabled:opacity-50 transition-all duration-200 tracking-wide"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-[#252525]/30 border-t-[#252525] animate-spin" />
                Creating account...
              </span>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#363636]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#252525] px-3 text-xs uppercase tracking-widest text-[#6B6B66]">
              Or continue with
            </span>
          </div>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
          className="w-full py-3 px-4 bg-[#2E2E2E] border border-[#363636] rounded-lg text-sm font-medium text-[#D6D3D1] hover:bg-[#363636] hover:text-white hover:border-[#44443F] active:scale-[0.98] flex items-center justify-center gap-3 transition-all duration-200"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#91918B" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#A8A29E" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#6B6B66" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#D6D3D1" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign up with Google
        </button>

        <p className="text-center text-sm text-[#6B6B66] mt-8">
          Already have an account?{" "}
          <Link href="/login" className="text-[#D6D3D1] hover:text-white transition-colors duration-150">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
