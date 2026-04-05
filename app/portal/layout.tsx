import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tenant Portal | OphirCRE",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Tenant-Facing Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-gray-900">OphirCRE</h1>
          <p className="text-sm text-gray-500">Tenant Portal</p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-600">Need Help? Call (555) 123-4567</span>
          <button className="text-sm text-red-600 font-medium hover:underline">Secure Logout</button>
        </div>
      </header>

      {/* Portal Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-8">
        {children}
      </main>
    </div>
  );
}