"use client";

import { useEffect, useState } from "react";

const NOTICE =
  "Your CAS credentials will only be used to access your course information, syllabi, and enrollment/capacity data from Yale systems. They will not be used for any other purpose.";

export function CasPanel() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [netid, setNetid] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [paired, setPaired] = useState(false);
  const [expired, setExpired] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = localStorage.getItem("shopper-profile");
    if (!current) {
      current = crypto.randomUUID();
      localStorage.setItem("shopper-profile", current);
    }
    setProfileId(current);
    void fetch(`/api/cas?profileId=${current}`)
      .then((response) => response.json())
      .then((body: { paired?: boolean; expired?: boolean }) => {
        setPaired(Boolean(body.paired));
        setExpired(Boolean(body.expired));
      })
      .catch(() => setMessage("Could not check stored credentials."));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!profileId || !accepted) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/cas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId, netid, password, termsAccepted: true }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(body?.error ?? "Could not store credentials.");
        return;
      }
      setPassword("");
      setPaired(true);
      setExpired(false);
      setMessage("Stored encrypted on the server. Shopper does not sign in to Yale.");
    } catch {
      setMessage("Could not store credentials.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!profileId) return;
    setBusy(true);
    await fetch("/api/cas", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    setPaired(false);
    setPassword("");
    setMessage("CAS credentials removed from this device’s Shopper profile.");
    setBusy(false);
  }

  return (
    <section className="rounded-xl border border-[#e4dccb] bg-white p-3">
      <h2 className="font-semibold">Pair Yale CAS</h2>
      <p className="mt-2 text-sm">{NOTICE}</p>
      {paired ? <p className="mt-2 text-sm text-[#1f7a4d]">CAS credentials are stored encrypted. Shopper does not sign in to Yale.</p> : null}
      {expired ? <p className="mt-2 text-sm text-[#9b2335]">Stored credentials expired after 14 days. Pair again.</p> : null}
      <form onSubmit={save} className="mt-3 space-y-2">
        <label className="block text-sm" htmlFor="netid">
          NetID
          <input id="netid" autoComplete="username" value={netid} onChange={(event) => setNetid(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d9d0c1] px-3 py-2" />
        </label>
        <label className="block text-sm" htmlFor="cas-password">
          Password
          <input id="cas-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d9d0c1] px-3 py-2" />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" />
          <span>
            I accept the terms. All data, including CAS credentials and calendar data, is encrypted at rest and in transit. It is stored only to provide Shopper’s features and will never be used, shared, or sold without your explicit permission.
          </span>
        </label>
        <button type="submit" disabled={!accepted || netid.trim().length < 2 || password.length < 1 || busy} className="rounded-md bg-[#00356b] px-3 py-2 text-sm text-white disabled:opacity-40">
          {paired ? "Update CAS credentials" : "Store encrypted credentials"}
        </button>
      </form>
      {paired ? (
        <button type="button" onClick={revoke} className="mt-2 text-sm text-[#9b2335] underline" disabled={busy}>
          Revoke stored credentials
        </button>
      ) : null}
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </section>
  );
}
