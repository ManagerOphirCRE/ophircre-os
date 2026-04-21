"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCalendarData() {
      const allEvents: any[] =[];

      // 1. Fetch Tasks (Due Dates)
      const { data: tasks } = await supabase.from('tasks').select('*').not('due_date', 'is', null);
      if (tasks) {
        tasks.forEach(t => {
          allEvents.push({
            id: `task_${t.id}`,
            title: `Task: ${t.title}`,
            start: new Date(t.due_date),
            end: new Date(t.due_date),
            allDay: true,
            type: 'task',
            resource: t
          });
        });
      }

      // 2. Fetch Property Tours
      const { data: tours } = await supabase.from('tours').select('*, properties(name), brokers(name)');
      if (tours) {
        tours.forEach(t => {
          const tourStart = new Date(t.tour_date);
          const tourEnd = new Date(tourStart.getTime() + 60 * 60 * 1000); // Assume 1 hour tour
          allEvents.push({
            id: `tour_${t.id}`,
            title: `Tour: ${t.prospect_name} at ${t.properties?.name}`,
            start: tourStart,
            end: tourEnd,
            allDay: false,
            type: 'tour',
            resource: t
          });
        });
      }

      // 3. Fetch Lease Expirations
      const { data: leases } = await supabase.from('leases').select('*, tenants(name), spaces(properties(name))');
      if (leases) {
        leases.forEach(l => {
          allEvents.push({
            id: `lease_${l.id}`,
            title: `EXPIRING: ${l.tenants?.name} (${l.spaces?.properties?.name})`,
            start: new Date(l.end_date),
            end: new Date(l.end_date),
            allDay: true,
            type: 'lease',
            resource: l
          });
        });
      }

      setEvents(allEvents);
      setIsLoading(false);
    }
    fetchCalendarData();
  },[]);

  const eventStyleGetter = (event: any) => {
    let backgroundColor = '#3174ad'; // Default Blue
    if (event.type === 'tour') backgroundColor = '#f97316'; // Orange
    if (event.type === 'lease') backgroundColor = '#ef4444'; // Red
    if (event.type === 'task') backgroundColor = '#10b981'; // Green

    return { style: { backgroundColor, borderRadius: '5px', opacity: 0.9, color: 'white', border: '0px', display: 'block' } };
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Master Calendar...</div>;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Master Operations Calendar</h2>
        <div className="flex space-x-4 text-xs font-bold">
          <span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span> Tasks</span>
          <span className="flex items-center"><span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span> Tours</span>
          <span className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span> Lease Expirations</span>
        </div>
      </header>

      <main className="flex-1 p-8 bg-gray-100 h-[calc(100vh-80px)]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day', 'agenda']}
            onSelectEvent={(event: any) => alert(`Details:\n\n${event.title}\nDate: ${event.start.toLocaleString()}`)}
          />
        </div>
      </main>
    </>
  );
}