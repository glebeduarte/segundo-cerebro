"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().auth.signInWithOtp({
      email, options: { emailRedirectTo: `${location.origin}/auth/callback`, shouldCreateUser: true },
    });
    setState(error ? "error" : "sent");
  }
  return (
    <main className="login">
      <form onSubmit={send}>
        <h1 style={{ fontSize: 32 }}>Segundo cérebro<b style={{ color: "var(--accent)" }}>.</b></h1>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="glebejr@gmail.com" />
        <button>Enviar link de acesso</button>
        {state === "sent" && <p>Link enviado. Abra o e-mail neste aparelho.</p>}
        {state === "error" && <p style={{ color: "#b42318" }}>Não consegui enviar o link. Tente de novo.</p>}
      </form>
    </main>
  );
}
