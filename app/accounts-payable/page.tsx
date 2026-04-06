"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function AccountsPayablePage() {
  const[invoices, setInvoices] = useState<any[]>([])
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => { fetchInvoices() },[])

  async function fetchInvoices() {
    const { data } = await supabase
      .from('vendor_submissions')
      .select('*, vendors(company_name), properties(name)')
      .eq('submission_type', 'Invoice')
      .neq('status', 'Paid')
      .order('created_at', { ascending: false })
    if (data) setInvoices(data)
  }

  function toggleSelection(id: string) {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter(i => i !== id))
    } else {
      setSelectedInvoices([...selectedInvoices, id])
    }
  }

  function toggleAll() {
    if (selectedInvoices.length === invoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(invoices.map(i => i.id))
    }
  }

  async function exportPaymentFile() {
    if (selectedInvoices.length === 0) return alert("Select at least one invoice.")
    setIsExporting(true)

    try {
      const toPay = invoices.filter(i => selectedInvoices.includes(i.id))
      let csvContent = "Payee Name,Amount,Memo,Property\n"
      
      toPay.forEach(inv => {
        const cleanVendor = inv.vendors?.company_name?.replace(/"/g, '""') || 'Unknown'
        const cleanNotes = inv.notes?.replace(/"/g, '""') || ''
        const cleanProp = inv.properties?.name?.replace(/"/g, '""') || ''
        csvContent += `"${cleanVendor}",${inv.amount},"${cleanNotes}","${cleanProp}"\n`
      })

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `ACH_Export_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Mark as Paid in DB
      const { error } = await supabase.from('vendor_submissions').update({ status: 'Paid' }).in('id', selectedInvoices)
      if (error) throw error
      
      alert("Payment file exported! Upload this to your bank.")
      setSelectedInvoices([])
      fetchInvoices()
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  const totalSelected = invoices.filter(i => selectedInvoices.includes(i.id)).reduce((sum, i) => sum + Number(i.amount), 0)

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Accounts Payable</h2>
        <button onClick={exportPaymentFile} disabled={isExporting || selectedInvoices.length === 0} className={`px-4 py-2 rounded-md font-medium text-white transition shadow-sm ${isExporting || selectedInvoices.length === 0 ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
          {isExporting ? 'Exporting...' : `Export NACHA / CSV (${selectedInvoices.length})`}
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Pending Vendor Invoices</h3>
            <span className="text-sm font-medium text-gray-600">Selected Total: <span className="text-green-600 font-bold">${totalSelected.toFixed(2)}</span></span>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left"><input type="checkbox" checked={selectedInvoices.length === invoices.length && invoices.length > 0} onChange={toggleAll} className="w-4 h-4 text-blue-600 rounded" /></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.length > 0 ? invoices.map((inv) => (
                <tr key={inv.id} className={selectedInvoices.includes(inv.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4"><input type="checkbox" checked={selectedInvoices.includes(inv.id)} onChange={() => toggleSelection(inv.id)} className="w-4 h-4 text-blue-600 rounded" /></td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.vendors?.company_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{inv.properties?.name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">${inv.amount}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{inv.notes}</td>
                </tr>
              )) : <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No pending invoices.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}