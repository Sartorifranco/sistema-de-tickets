import React, { useMemo, useState } from 'react';
import { WEEKDAYS, isoWeekday } from './routePlanner';

interface Props {
    plans: Record<number, number[]>;
    labels: Record<number, string>;
    focusDay: number;
    onPick: (date: Date) => void;
}

function monthCells(year: number, month: number): (Date | null)[] {
    const first = new Date(year, month, 1);
    let lead = first.getDay() - 1;
    if (lead < 0) lead = 6;
    const count = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let day = 1; day <= count; day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const RouteCalendar: React.FC<Props> = ({ plans, labels, focusDay, onPick }) => {
    const today = useMemo(() => new Date(), []);
    const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
    const cells = monthCells(cursor.getFullYear(), cursor.getMonth());
    const title = cursor.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const shiftMonth = (delta: number) => {
        setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    };

    return (
        <div className="bg-white border rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
                <button type="button" onClick={() => shiftMonth(-1)} className="min-h-11 min-w-11 rounded-xl border font-bold text-slate-700">‹</button>
                <div className="text-center">
                    <p className="text-base font-bold capitalize text-slate-900">{title}</p>
                    <p className="text-[11px] text-slate-500">Tocá un día para abrir su hoja. Se repite todas las semanas.</p>
                </div>
                <button type="button" onClick={() => shiftMonth(1)} className="min-h-11 min-w-11 rounded-xl border font-bold text-slate-700">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((day) => (
                    <div key={day.id} className="text-center text-[10px] font-semibold uppercase text-slate-400">{day.short}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {cells.map((date, index) => {
                    if (!date) return <div key={`empty-${index}`} />;
                    const weekday = isoWeekday(date);
                    const count = (plans[weekday] || []).length;
                    const hasPlan = count > 0;
                    const isToday = sameDay(date, today);
                    const selected = weekday === focusDay;
                    return (
                        <button
                            key={date.toISOString()}
                            type="button"
                            onClick={() => onPick(date)}
                            className={`min-h-[4.5rem] rounded-xl border px-1 py-1 text-left flex flex-col ${
                                selected ? 'border-slate-900 ring-2 ring-slate-900' : hasPlan ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                            }`}
                        >
                            <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-slate-900 text-white' : 'text-slate-800'}`}>
                                {date.getDate()}
                            </span>
                            <span className={`mt-1 text-[10px] leading-tight line-clamp-3 ${hasPlan ? 'text-emerald-900 font-medium' : 'text-slate-400'}`}>
                                {hasPlan ? (labels[weekday] || `${count} equipos`) : 'Sin hoja'}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default RouteCalendar;
