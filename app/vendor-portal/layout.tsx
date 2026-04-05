import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendor Portal | OphirCRE",
};

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white px-8 py-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-xl font-bold tracking-wider">OphirCRE</h1>
          <p className="text-xs text-slate-400 uppercase tracking-widest">Vendor Access Portal</p>
        </div>
        <div className="text-sm font-medium text-slate-300">
          Accounts Payable & Compliance
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto p-8">
        {children}
      </main>
    </div>
  );
}