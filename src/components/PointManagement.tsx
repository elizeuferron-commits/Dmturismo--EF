import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, doc, updateDoc, serverTimestamp, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanUndefined } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { Journey, Employee, WorkShift } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addHours, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Card } from './Cards';
import { Edit3, User as UserIcon, Save, Plus, FileText, Download, Printer, Clock, Trash2, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal, ConfirmModal, Input, Button } from './UI';

interface PointManagementProps {
    user: any;
}

export const PointManagement = ({ user }: PointManagementProps) => {
    const [journeys, setJourneys] = useState<Journey[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editData, setEditData] = useState<{ 
        startTime: string; 
        endTime: string; 
        date: string;
        entryType: 'normal' | 'vacation' | 'day_off' | 'overtime';
        breakStart: string;
        breakEnd: string;
        notes: string;
    }>({ 
        startTime: '', 
        endTime: '', 
        date: '',
        entryType: 'normal',
        breakStart: '',
        breakEnd: '',
        notes: ''
    });
    const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [isReportsMenuOpen, setIsReportsMenuOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; journey: Journey | null }>({
        isOpen: false,
        journey: null
    });
    const longPressTimer = useRef<any>(null);
    const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});
    const [isPreencherModalOpen, setIsPreencherModalOpen] = useState(false);
    const [preencherMonth, setPreencherMonth] = useState(format(new Date(), 'yyyy-MM'));

    const isAdministrative = useMemo(() => {
        return user?.role === 'Dono / Proprietário' || 
               user?.role === 'Dono' || 
               user?.role === 'Proprietário' || 
               user?.role === 'Gestor de Frotas' ||
               user?.role === 'Coordenador Logístico' ||
               user?.role === 'Administrativo' ||
               user?.email === 'elizeuferron@gmail.com';
    }, [user]);

    useEffect(() => {
        const unsubJourneys = dbCacheService.subscribeCollection('journeys', (data) => {
            setJourneys(data as Journey[]);
        });

        const unsubEmployees = dbCacheService.subscribeCollection('employees', (data) => {
            setEmployees(data as Employee[]);
        });

        return () => {
            unsubJourneys();
            unsubEmployees();
        };
    }, []);

    const safeFormat = (date: any, formatStr: string) => {
        try {
            const d = date instanceof Date ? date : parseDate(date);
            if (isNaN(d.getTime())) return '--:--';
            return format(d, formatStr, { locale: ptBR });
        } catch (e) {
            return '--:--';
        }
    };

    const getExpectedSchedule = (employee: Employee, date: string): { start: string, end: string, isOff: boolean, breakStart?: string, breakEnd?: string } => {
        const d = parseISO(date);
        const dayOfWeek = getDay(d); // 0 = Sunday, 1 = Monday, ...

        if (employee.workSchedule) {
            // Seg-Sex (1-5)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const ms = employee.workSchedule.monToFri;
                if (ms && ms.morning && ms.afternoon && ms.morning.start && ms.afternoon.end) {
                    return { 
                        start: ms.morning.start, 
                        end: ms.afternoon.end, 
                        isOff: false, 
                        breakStart: ms.morning.end, 
                        breakEnd: ms.afternoon.start 
                    };
                }
            }
            // Sáb (6)
            if (dayOfWeek === 6) {
                const sat = employee.workSchedule.saturday;
                if (sat && sat.start && sat.end) {
                    return { start: sat.start, end: sat.end, isOff: false };
                }
            }
            // Dom (0)
            if (dayOfWeek === 0) {
                const sun = employee.workSchedule.sunday;
                if (sun && sun.start && sun.end) {
                    return { start: sun.start, end: sun.end, isOff: false };
                }
            }
        }

        // Regra Unificada DM Turismo (Padrão Ana Paula / Coelho): 
        // Seg-Sex: 08:00-18:00 (Intervalo 11:30-13:00)
        // Sáb: 08:00-12:00
        // Dom: Folga
        if (dayOfWeek === 0) return { start: '', end: '', isOff: true }; // Domingo Folga
        if (dayOfWeek === 6) return { start: '08:00', end: '12:00', isOff: false }; // Sábado Meio Período
        
        return { 
            start: '08:00', 
            end: '18:00', 
            isOff: false, 
            breakStart: '11:30', 
            breakEnd: '13:00' 
        }; // Dia de Semana (Padrão Unificado)
    };

    const handleEdit = (employee: Employee, journey: Journey) => {
        setSelectedEmployee(employee);
        setEditingJourney(journey);
        
        const safeStart = safeFormat(journey.startTime, "yyyy-MM-dd'T'HH:mm");
        const safeEnd = journey.endTime ? safeFormat(journey.endTime, "yyyy-MM-dd'T'HH:mm") : '';
        const safeBreakStart = journey.breaks?.[0]?.start ? safeFormat(journey.breaks[0].start, "yyyy-MM-dd'T'HH:mm") : '';
        const safeBreakEnd = journey.breaks?.[0]?.end ? safeFormat(journey.breaks[0].end, "yyyy-MM-dd'T'HH:mm") : '';

        setEditData({ 
            date: journey.date || format(new Date(), 'yyyy-MM-dd'),
            startTime: safeStart === '--:--' ? '' : safeStart,
            endTime: safeEnd === '--:--' ? '' : safeEnd,
            entryType: journey.entryType || 'normal',
            breakStart: safeBreakStart === '--:--' ? '' : safeBreakStart,
            breakEnd: safeBreakEnd === '--:--' ? '' : safeBreakEnd,
            notes: journey.notes || ''
        });
        setIsModalOpen(true);
    };

    const handleManualAddAtDate = (employee: Employee, dateStr: string) => {
        setSelectedEmployee(employee);
        setEditingJourney(null);
        const expected = getExpectedSchedule(employee, dateStr);

        setEditData({
            date: dateStr,
            startTime: expected.isOff ? '' : `${dateStr}T${expected.start}`,
            endTime: expected.isOff ? '' : `${dateStr}T${expected.end}`,
            entryType: expected.isOff ? 'day_off' : 'normal',
            breakStart: expected.breakStart ? `${dateStr}T${expected.breakStart}` : '',
            breakEnd: expected.breakEnd ? `${dateStr}T${expected.breakEnd}` : '',
            notes: ''
        });
        setIsModalOpen(true);
    };

    const handleManualAdd = (employee: Employee) => {
        const now = new Date();
        const dateStr = format(now, 'yyyy-MM-dd');
        handleManualAddAtDate(employee, dateStr);
    };

    const handleDateChange = (newDate: string) => {
        setEditData(prev => {
            const syncDate = (dateTimeStr: string) => {
                if (!dateTimeStr) return '';
                const timePart = dateTimeStr.split('T')[1] || '00:00';
                return `${newDate}T${timePart}`;
            };

            return {
                ...prev,
                date: newDate,
                startTime: syncDate(prev.startTime),
                endTime: syncDate(prev.endTime),
                breakStart: syncDate(prev.breakStart),
                breakEnd: syncDate(prev.breakEnd)
            };
        });
    };

    const handleAutoFillMonth = async (employee: Employee, customMonth?: string) => {
        const targetMonth = customMonth || reportMonth;
        const start = startOfMonth(parseISO(targetMonth + '-01'));
        const end = endOfMonth(start);
        
        const existingDates = new Set((groupedJourneys[employee.id] || [])
            .map(j => j.date)
            .filter((d): d is string => !!d && d.startsWith(targetMonth)));
        
        let count = 0;
        const batch = [];
        
        const current = new Date(start);
        while (current <= end) {
            const dateStr = format(current, 'yyyy-MM-dd');
            const dayOfWeek = getDay(current);

            // Regra Unificada DM Turismo: 08:00-18:00 (Intervalo 11:30-13:00)
            // Se for domingo (0), podemos pular, ou manter a regra se o usuário preferir, mas vamos pular domingo.
            if (dayOfWeek === 0) {
                current.setDate(current.getDate() + 1);
                continue;
            }

            const expected = { 
                start: '08:00', 
                end: '18:00', 
                isOff: false, 
                breakStart: '11:30', 
                breakEnd: '13:00' 
            };

            if (!existingDates.has(dateStr)) {
                const startLocal = new Date(`${dateStr}T${expected.start}`);
                const endLocal = new Date(`${dateStr}T${expected.end}`);
                
                const breaks = [];
                if (!expected.isOff && expected.breakStart && expected.breakEnd) {
                    breaks.push({
                        start: new Date(`${dateStr}T${expected.breakStart}`).toISOString(),
                        end: new Date(`${dateStr}T${expected.breakEnd}`).toISOString()
                    });
                }

                batch.push({
                    employeeId: employee.id,
                    employeeName: employee.name,
                    date: dateStr,
                    startTime: startLocal.toISOString(),
                    endTime: endLocal.toISOString(),
                    entryType: expected.isOff ? 'day_off' : 'normal',
                    breaks,
                    status: 'completed',
                    notes: 'Preenchimento Automático (Regra Unificada)',
                    createdAt: serverTimestamp()
                });
                count++;
            }
            current.setDate(current.getDate() + 1);
        }

        if (count === 0) {
            toast.info('Nenhum dia de trabalho disponível para preenchimento automático.');
            return;
        }

        if (!confirm(`Deseja aplicar a REGRA UNIFICADA (08-18h | Intervalo 11:30) para preencher automaticamente ${count} dias de trabalho para ${employee.name}?`)) return;

        const toastId = toast.loading(`Preenchendo escala de ${employee.name}...`);
        try {
            await Promise.all(batch.map(data => addDoc(collection(db, 'journeys'), cleanUndefined(data))));
            toast.success(`${count} registros criados com sucesso!`, { id: toastId });
        } catch (error) {
            toast.error('Erro ao gerar registros.', { id: toastId });
            handleFirestoreError(error, OperationType.WRITE, 'journeys');
        }
    };

    const handleEntryTypeChange = (type: 'normal' | 'vacation' | 'day_off' | 'overtime') => {
        if (!selectedEmployee) return;
        const dateStr = editData.date;
        const expected = getExpectedSchedule(selectedEmployee, dateStr);

        let startTime = editData.startTime;
        let endTime = editData.endTime;
        let breakStart = '';
        let breakEnd = '';

        if (type === 'vacation' || type === 'day_off') {
            startTime = `${dateStr}T00:00`;
            endTime = `${dateStr}T00:00`;
        } else if (type === 'normal') {
            startTime = expected.isOff ? '' : `${dateStr}T${expected.start}`;
            endTime = expected.isOff ? '' : `${dateStr}T${expected.end}`;
            breakStart = expected.breakStart ? `${dateStr}T${expected.breakStart}` : '';
            breakEnd = expected.breakEnd ? `${dateStr}T${expected.breakEnd}` : '';
        }

        setEditData({ ...editData, entryType: type, startTime, endTime, breakStart, breakEnd });
    };

    const saveEntry = async () => {
        if (!selectedEmployee) return;
        try {
            const start = new Date(editData.startTime);
            const end = editData.endTime ? new Date(editData.endTime) : null;
            
            const breaks = [];
            if (editData.breakStart && editData.breakEnd) {
                breaks.push({
                    start: new Date(editData.breakStart).toISOString(),
                    end: new Date(editData.breakEnd).toISOString()
                });
            }

            const data = {
                employeeId: selectedEmployee.id,
                employeeName: selectedEmployee.name,
                date: editData.date,
                startTime: start.toISOString(),
                endTime: end ? end.toISOString() : null,
                entryType: editData.entryType,
                notes: editData.notes,
                breaks,
                status: end ? 'completed' : 'active',
                updatedAt: serverTimestamp()
            };

            if (editingJourney) {
                await updateDoc(doc(db, 'journeys', editingJourney.id), cleanUndefined(data));
                toast.success('Registro atualizado com sucesso!');
            } else {
                await addDoc(collection(db, 'journeys'), cleanUndefined({
                    ...data,
                    createdAt: serverTimestamp()
                }));
                toast.success('Novo registro adicionado!');
            }
            setIsModalOpen(false);
            setEditingJourney(null);
            setSelectedEmployee(null);
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'journeys');
        }
    };

    const confirmDeleteJourney = async () => {
        if (!deleteConfirm.journey) return;

        try {
            await deleteDoc(doc(db, 'journeys', deleteConfirm.journey.id));
            toast.success('Registro excluído com sucesso!');
        } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, 'journeys');
        } finally {
            setDeleteConfirm({ isOpen: false, journey: null });
        }
    };

    const generatePDF = async (employee: Employee) => {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF();
        const start = startOfMonth(parseISO(reportMonth + '-01'));
        const end = endOfMonth(start);
        
        const journeysByDate = (groupedJourneys[employee.id] || []).reduce((acc, j) => {
            acc[j.date] = j;
            return acc;
        }, {} as Record<string, Journey>);

        // Header
        doc.setFontSize(18);
        doc.text('FOLHA DE PONTO MENSAL', 105, 15, { align: 'center' });
        doc.setFontSize(14);
        doc.text('DM TURISMO', 105, 22, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Colaborador: ${employee.name.toUpperCase()}`, 14, 35);
        doc.setFont('helvetica', 'normal');
        doc.text(`Função: ${employee.role}`, 14, 40);
        doc.text(`Período: ${format(start, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}`, 14, 45);
        
        doc.line(14, 48, 196, 48); // Hero line
        
        let totalMonthlyMinutes = 0;
        const tableData = [];
        
        const current = new Date(start);
        while (current <= end) {
            const dateStr = format(current, 'yyyy-MM-dd');
            const j = journeysByDate[dateStr];
            const expected = getExpectedSchedule(employee, dateStr);
            
            let startStr = '--:--';
            let endStr = '--:--';
            let breakStr = '--:--';
            let typeLabel = expected.isOff ? 'Folga Escala' : 'Falta/N. Lan.';
            let durationStr = '---';

            if (j) {
                startStr = safeFormat(j.startTime, 'HH:mm');
                endStr = j.endTime ? safeFormat(j.endTime, 'HH:mm') : '--:--';
                
                if (j.breaks && j.breaks.length > 0 && j.breaks[0].start && j.breaks[0].end) {
                    breakStr = `${safeFormat(j.breaks[0].start, 'HH:mm')} - ${safeFormat(j.breaks[0].end, 'HH:mm')}`;
                }

                if (j.endTime) {
                    const startD = parseDate(j.startTime);
                    const endD = parseDate(j.endTime);
                    
                    if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
                        let diffInMs = endD.getTime() - startD.getTime();
                        
                        if (j.breaks) {
                            j.breaks.forEach(b => {
                                if (b.start && b.end) {
                                    const bStart = parseDate(b.start);
                                    const bEnd = parseDate(b.end);
                                    if (!isNaN(bStart.getTime()) && !isNaN(bEnd.getTime())) {
                                        diffInMs -= (bEnd.getTime() - bStart.getTime());
                                    }
                                }
                            });
                        }

                        const diff = diffInMs / (1000 * 60);
                        totalMonthlyMinutes += diff;
                        const h = Math.floor(diff / 60);
                        const m = Math.round(diff % 60);
                        durationStr = `${h}h ${m}m`;
                    }
                }

                const typeLabels: Record<string, string> = {
                    'normal': 'Normal',
                    'vacation': 'Férias',
                    'day_off': 'Folga',
                    'overtime': 'H. Extras'
                };
                typeLabel = typeLabels[j.entryType || 'normal'] || 'Normal';
            }

            tableData.push([
                format(current, 'dd/MM/yyyy'),
                format(current, 'EEEE', { locale: ptBR }),
                startStr,
                breakStr,
                endStr,
                typeLabel,
                durationStr
            ]);
            
            current.setDate(current.getDate() + 1);
        }

        autoTable(doc, {
            startY: 52,
            head: [['Data', 'Dia', 'Entrada', 'Intervalo', 'Saída', 'Tipo', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            bodyStyles: { fontSize: 8, halign: 'center' },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'left' },
                6: { fontStyle: 'bold' }
            },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            margin: { top: 10 }
        });

        const finalH = Math.floor(totalMonthlyMinutes / 60);
        const finalM = Math.round(totalMonthlyMinutes % 60);
        const totalY = (doc as any).lastAutoTable.finalY + 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOTAL DE HORAS TRABALHADAS NO MÊS: ${finalH}h ${finalM}m`, 14, totalY);

        // Signatures
        const signY = totalY + 60;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        
        doc.line(14, signY, 90, signY);
        doc.text('ASSINATURA DO COLABORADOR', 14, signY + 5);
        
        doc.line(120, signY, 196, signY);
        doc.text('ASSINATURA DO GESTOR - DM TURISMO', 120, signY + 5);

        doc.save(`Cartao_Ponto_${employee.name.replace(/\s/g, '_')}_${reportMonth}.pdf`);
        toast.success('Relatório PDF gerado com sucesso!');
    };

    const generateMonthlyTeamSummaryPDF = async () => {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF('l', 'mm', 'a4');
        const start = startOfMonth(parseISO(reportMonth + '-01'));
        const end = endOfMonth(start);
        
        doc.setFontSize(22);
        doc.setTextColor(30, 30, 30);
        doc.text('DM TURISMO - RESUMO MENSAL DE JORNADA', 148.5, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`PERÍODO: ${format(start, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}`, 148.5, 28, { align: 'center' });
        doc.text(`GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 148.5, 34, { align: 'center' });

        const tableData = employees.map(emp => {
            const empJourneys = employeeJourneys[emp.id] || [];
            let totalMinutes = 0;
            let workDays = 0;
            let absences = 0;

            const current = new Date(start);
            while (current <= end) {
                const dateStr = format(current, 'yyyy-MM-dd');
                const j = empJourneys.find(journey => journey.date === dateStr);
                const expected = getExpectedSchedule(emp, dateStr);

                if (j) {
                    if (j.entryType === 'normal' || j.entryType === 'overtime') {
                        totalMinutes += calculateDuration(j);
                        workDays++;
                    }
                } else if (!expected.isOff) {
                    absences++;
                }
                current.setDate(current.getDate() + 1);
            }

            const h = Math.floor(totalMinutes / 60);
            const m = Math.round(totalMinutes % 60);

            return [
                emp.name.toUpperCase(),
                emp.role.toUpperCase(),
                workDays,
                absences,
                `${h}h ${m}m`
            ];
        });

        autoTable(doc, {
            startY: 45,
            head: [['COLABORADOR', 'FUNÇÃO', 'DIAS TRABALHADOS', 'FALTAS/N. LANÇADOS', 'TOTAL HORAS']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            bodyStyles: { fontSize: 9, halign: 'center', textColor: [50, 50, 50] },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold' },
                1: { halign: 'left' }
            },
            alternateRowStyles: { fillColor: [250, 250, 250] }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 20;
        doc.line(100, finalY, 198.5, finalY);
        doc.setFontSize(8);
        doc.text('ASSINATURA DO GESTOR RESPONSÁVEL', 148.5, finalY + 5, { align: 'center' });

        doc.save(`Resumo_Mensal_Ponto_${reportMonth}.pdf`);
        toast.success('Relatório mensal (equipe) gerado com sucesso!');
    };

    const calculateDuration = (journey: Journey) => {
        if (!journey.startTime || !journey.endTime) return 0;
        const startD = parseDate(journey.startTime);
        const endD = parseDate(journey.endTime);
        if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return 0;
        
        let diff = endD.getTime() - startD.getTime();
        if (journey.breaks) {
            journey.breaks.forEach(b => {
                if (b.start && b.end) {
                    const bStart = parseDate(b.start);
                    const bEnd = parseDate(b.end);
                    if (!isNaN(bStart.getTime()) && !isNaN(bEnd.getTime())) {
                        diff -= (bEnd.getTime() - bStart.getTime());
                    }
                }
            });
        }
        return diff / (1000 * 60);
    };

    const formatDuration = (totalMinutes: number) => {
        const h = Math.floor(totalMinutes / 60);
        const m = Math.round(totalMinutes % 60);
        return `${h}h ${m}m`;
    };

    const groupedJourneys = useMemo(() => {
        return journeys.reduce((acc, journey) => {
            if (!acc[journey.employeeId]) acc[journey.employeeId] = [];
            acc[journey.employeeId].push(journey);
            return acc;
        }, {} as Record<string, Journey[]>);
    }, [journeys]);

    const employeeJourneys = useMemo(() => {
        const result: Record<string, Journey[]> = {};
        employees.forEach(emp => {
            result[emp.id] = (groupedJourneys[emp.id] || [])
                .filter(j => {
                    const d = parseDate(j.date);
                    if (isNaN(d.getTime())) return false;
                    return format(d, 'yyyy-MM') === reportMonth;
                })
                .sort((a, b) => {
                    const da = parseDate(a.date);
                    const db = parseDate(b.date);
                    if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
                    return da.getTime() - db.getTime();
                });
        });
        return result;
    }, [employees, groupedJourneys, reportMonth]);

    return (
        <div className="space-y-8 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Gestão de Jornada</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Controle Inteligente DM Turismo</p>
                        <span className="px-2 py-0.5 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-[8px] font-black uppercase rounded-full tracking-widest">
                            Regra Unificada: 08-18h (Intervalo 11:30)
                        </span>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    {isAdministrative && (
                        <>
                            <div className="relative">
                                <button 
                                    onClick={() => setIsReportsMenuOpen(!isReportsMenuOpen)}
                                    className="flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all border border-zinc-700 shadow-xl active:scale-95"
                                >
                                    <Download size={16} /> Relatórios
                                    <ChevronDown size={14} className={cn("transition-transform duration-200", isReportsMenuOpen ? "rotate-180" : "")} />
                                </button>
                                
                                {isReportsMenuOpen && (
                                    <div className="reports-menu-wrapper">
                                        <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => setIsReportsMenuOpen(false)} 
                                        />
                                        <div className="absolute right-0 mt-3 w-80 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden py-3 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                            <div className="px-4 py-2 border-b border-zinc-800 mb-2">
                                                <h4 className="text-[9px] font-black text-brand-accent uppercase tracking-widest">Painel de Exportação</h4>
                                            </div>
                                            
                                            <button 
                                                onClick={() => {
                                                    generateMonthlyTeamSummaryPDF();
                                                    setIsReportsMenuOpen(false);
                                                }}
                                                className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/5 text-left transition-all border-l-4 border-transparent hover:border-brand-accent"
                                            >
                                                <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center text-brand-accent shrink-0">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Relatório Mensal Equipe</p>
                                                    <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">Visão consolidada de todo o DM Turismo</p>
                                                </div>
                                            </button>

                                            <div className="mx-4 my-3 flex items-center gap-3">
                                                <div className="h-px bg-zinc-800 flex-1" />
                                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em]">Individual</span>
                                                <div className="h-px bg-zinc-800 flex-1" />
                                            </div>

                                            <div className="max-h-64 overflow-y-auto px-2 space-y-1">
                                                {employees.map(emp => (
                                                    <button 
                                                        key={emp.id}
                                                        onClick={() => {
                                                            generatePDF(emp);
                                                            setIsReportsMenuOpen(false);
                                                        }}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/50 rounded-xl text-left text-zinc-400 hover:text-white transition-all group"
                                                    >
                                                        <div className="w-7 h-7 bg-zinc-800 rounded-lg flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                                                            <UserIcon size={12} />
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-tight">{emp.name}</span>
                                                        <Printer size={10} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </button>
                                                ))}
                                            </div>
                                            
                                            <div className="mt-4 p-4 bg-zinc-950/50 italic text-center">
                                                <p className="text-[8px] text-zinc-600 font-bold uppercase">Selecione o relatório para baixar em PDF</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                        <button 
                            onClick={async () => {
                                // Fetch list of employees using cache
                                const { dbCacheService } = await import('../services/dbCacheService');
                                const freshEmployees = await dbCacheService.getEmployees();

                                const confirmMsg = `Executar PREENCHIMENTO GLOBAL para toda a equipe (${freshEmployees.length} funcionários)?\n\nIsso gerará todos os registros faltantes para o mês de ${format(parseISO(reportMonth + '-01'), 'MMMM', { locale: ptBR })} seguindo a regra 08/18h.`;
                                if (!confirm(confirmMsg)) return;

                                const toastId = toast.loading('Processando preenchimento em massa...');
                                try {
                                    let total = 0;
                                    for (const emp of freshEmployees) {
                                        const start = startOfMonth(parseISO(reportMonth + '-01'));
                                        const end = endOfMonth(start);
                                        const existing = new Set((groupedJourneys[emp.id] || [])
                                            .map(j => j.date)
                                            .filter(d => !!d && d.startsWith(reportMonth)));
                                        
                                        const batch = [];
                                        const curr = new Date(start);
                                        while (curr <= end) {
                                            const ds = format(curr, 'yyyy-MM-dd');
                                            const exp = getExpectedSchedule(emp, ds);
                                            if (!existing.has(ds)) {
                                                const startL = exp.isOff ? new Date(`${ds}T00:00`) : new Date(`${ds}T${exp.start}`);
                                                const endL = exp.isOff ? new Date(`${ds}T00:00`) : new Date(`${ds}T${exp.end}`);

                                                batch.push({
                                                    employeeId: emp.id,
                                                    employeeName: emp.name,
                                                    date: ds,
                                                    startTime: startL.toISOString(),
                                                    endTime: endL.toISOString(),
                                                    entryType: exp.isOff ? 'day_off' : 'normal',
                                                    breaks: (!exp.isOff && exp.breakStart) ? [{
                                                        start: new Date(`${ds}T${exp.breakStart}`).toISOString(),
                                                        end: new Date(`${ds}T${exp.breakEnd}`).toISOString()
                                                    }] : [],
                                                    status: 'completed',
                                                    notes: 'Preenchimento Automático (Batido)',
                                                    createdAt: serverTimestamp()
                                                });
                                            }
                                            curr.setDate(curr.getDate() + 1);
                                        }
                                        if (batch.length > 0) {
                                            await Promise.all(batch.map(d => addDoc(collection(db, 'journeys'), cleanUndefined(d))));
                                            total += batch.length;
                                        }
                                    }
                                    toast.success(`${total} registros gerados para a equipe!`, { id: toastId });
                                } catch (e) {
                                    toast.error('Erro no preenchimento global.', { id: toastId });
                                }
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-brand-accent text-zinc-950 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-brand-accent/20 active:scale-95 border-2 border-brand-accent">
                        
                            <Clock size={16} /> Preenchimento Automático Equipe
                        </button>

                    <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-2xl border border-zinc-800">
                        <label className="text-[10px] font-black text-zinc-500 uppercase px-2">Período:</label>
                        <input 
                            type="month" 
                            value={reportMonth} 
                            onChange={e => setReportMonth(e.target.value)}
                            className="bg-zinc-950 text-white text-xs font-bold border-none focus:ring-0 rounded-lg p-1"
                        />
                    </div>
                        </>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 gap-8">
                {employees.map(employee => {
                    const sortedJourneys = employeeJourneys[employee.id] || [];

                    return (
                        <Card key={employee.id} className="bg-zinc-900 border-zinc-800 p-8 shadow-2xl rounded-3xl overflow-hidden group">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-zinc-800 pb-8">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700 group-hover:border-brand-accent transition-all relative">
                                        <UserIcon className="text-zinc-500 group-hover:text-brand-accent w-8 h-8" />
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-zinc-900 rounded-full" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h2 className="text-2xl font-black text-white uppercase leading-none tracking-tighter">{employee.name}</h2>
                                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase rounded-full border border-emerald-500/20">Vinculado</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest leading-none">{employee.role}</p>
                                            <span className="text-[10px] text-zinc-700 font-bold">•</span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] font-black text-brand-accent uppercase tracking-tighter">Regra Unificada</span>
                                                <div className="w-1 h-1 bg-brand-accent rounded-full animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-2">
                                    {isAdministrative && (
                                        <>
                                            <button 
                                                onClick={() => {setSelectedEmployee(employee); setIsPreencherModalOpen(true);}}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all active:scale-95 shadow-lg shadow-emerald-500/10"
                                            >
                                                <Clock size={14} fill="currentColor" /> Preencher
                                            </button>
                                            <button 
                                                onClick={() => handleManualAdd(employee)}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all active:scale-95 border border-zinc-700"
                                            >
                                                <Plus size={14} /> Lançar Avulso
                                            </button>
                                            <button 
                                                onClick={() => generatePDF(employee)}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent/10 text-brand-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-accent hover:text-zinc-950 transition-all active:scale-95 border border-brand-accent/20"
                                            >
                                                <Printer size={14} /> Gerar Relatório
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 mb-6 bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/50 cursor-pointer" onClick={() => setExpandedStates(prev => ({ ...prev, [employee.id]: !prev[employee.id] }))}>
                                <FileText className="w-5 h-5 text-zinc-500" />
                                <div>
                                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Pré-visualização do Cartão Ponto {expandedStates[employee.id] ? '(Ocultar)' : '(Mostrar)'}</h3>
                                    <p className="text-[9px] text-zinc-500 font-medium uppercase mt-1">Clique para {expandedStates[employee.id] ? 'ocultar' : 'exibir'} a pré-visualização</p>
                                </div>
                            </div>
                            
                            {expandedStates[employee.id] && (
                            <div className="overflow-x-auto rounded-xl border border-zinc-800/50 shadow-inner bg-zinc-950/20">
                                <table className="w-full text-left text-xs text-zinc-300">
                                    <thead className="bg-zinc-950 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                        <tr>
                                            <th className="p-4 rounded-tl-xl text-zinc-400">Data / Escala</th>
                                            <th className="p-4 text-brand-accent/70">Entrada</th>
                                            <th className="p-4 text-zinc-400">Intervalo</th>
                                            <th className="p-4 text-zinc-400">SAÍDA</th>
                                            <th className="p-4 text-zinc-400">Duração Eficaz</th>
                                            <th className="p-4 text-right rounded-tr-xl text-zinc-400">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const start = startOfMonth(parseISO(reportMonth + '-01'));
                                            const end = endOfMonth(start);
                                            const journeysByDate = (employeeJourneys[employee.id] || []).reduce((acc, j) => {
                                                acc[j.date] = j;
                                                return acc;
                                            }, {} as Record<string, Journey>);

                                            const rows = [];
                                            const current = new Date(start);
                                            while (current <= end) {
                                                const dateStr = format(current, 'yyyy-MM-dd');
                                                const journey = journeysByDate[dateStr];
                                                const expected = getExpectedSchedule(employee, dateStr);
                                                
                                                const durationMinutes = journey ? calculateDuration(journey) : 0;
                                                const totalHours = journey?.endTime ? formatDuration(durationMinutes) : '--:--';

                                                rows.push(
                                                    <tr 
                                                        key={dateStr} 
                                                        className={cn(
                                                            "border-t border-zinc-800 hover:bg-white/5 transition-colors cursor-pointer select-none group/row",
                                                            !journey && !expected.isOff && "bg-brand-accent/[0.03]",
                                                            expected.isOff && "bg-zinc-900/50"
                                                        )}
                                                        onClick={() => journey ? handleEdit(employee, journey) : handleManualAddAtDate(employee, dateStr)}
                                                    >
                                                        <td className="p-4">
                                                            <div className="flex flex-col">
                                                                <span className={cn("font-bold transition-colors", journey ? "text-zinc-100" : "text-zinc-600 group-hover/row:text-zinc-400")}>
                                                                    {format(current, 'dd/MM/yyyy')}
                                                                </span>
                                                                <span className="text-[9px] font-black text-zinc-500 group-hover/row:text-brand-accent uppercase tracking-tighter transition-colors">
                                                                    {format(current, 'EEEE', { locale: ptBR })} 
                                                                    {expected.isOff ? ' (FOLGA)' : ` • ESCALA: ${expected.start}-${expected.end}`}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className={cn("p-4 font-mono", journey ? "text-zinc-100" : "text-zinc-800 italic")}>
                                                            {journey ? safeFormat(journey.startTime, 'HH:mm') : (expected.isOff ? '--:--' : expected.start)}
                                                        </td>
                                                        <td className="p-4 font-mono text-zinc-400 text-[10px]">
                                                            {journey?.breaks?.[0]?.start ? (
                                                                `${safeFormat(journey.breaks[0].start, 'HH:mm')} - ${safeFormat(journey.breaks[0].end!, 'HH:mm')}`
                                                            ) : (expected.breakStart ? `${expected.breakStart} - ${expected.breakEnd}` : '--:--')}
                                                            {journey?.status === 'completed' && (
                                                                <span className="ml-2 text-[8px] bg-emerald-500/10 text-emerald-500 px-1 rounded uppercase font-black">Batido</span>
                                                            )}
                                                        </td>
                                                        <td className={cn("p-4 font-mono", journey ? "text-zinc-100" : "text-zinc-800 italic")}>
                                                            {journey?.endTime ? safeFormat(journey.endTime, 'HH:mm') : (expected.isOff ? '--:--' : expected.end)}
                                                        </td>
                                                        <td className="p-4 font-mono">
                                                            {journey ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-brand-accent font-bold">{totalHours}</span>
                                                                    {journey.status === 'completed' && (
                                                                        <span className="text-[7px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded uppercase font-black border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">Batido</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                expected.isOff ? (
                                                                    <span className="text-zinc-700 opacity-30">---</span>
                                                                ) : (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-zinc-800 italic text-[10px]">Pendente</span>
                                                                        <span className="text-[8px] bg-brand-accent/5 text-brand-accent/40 border border-brand-accent/10 px-1 rounded uppercase font-black">Plan</span>
                                                                    </div>
                                                                )
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                {journey ? (
                                                                    <>
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); handleEdit(employee, journey); }} 
                                                                            className="p-2 bg-zinc-800 text-zinc-400 hover:text-brand-accent rounded-lg transition-colors"
                                                                        >
                                                                            <Edit3 size={14} />
                                                                        </button>
                                                                        <button 
                                                                            onClick={(e) => { 
                                                                                e.stopPropagation(); 
                                                                                setDeleteConfirm({ isOpen: true, journey });
                                                                            }} 
                                                                            className="p-2 bg-zinc-800 text-zinc-400 hover:text-rose-500 rounded-lg transition-colors"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    !expected.isOff && (
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); handleManualAddAtDate(employee, dateStr); }} 
                                                                            className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-zinc-950 rounded-lg transition-all"
                                                                        >
                                                                            <Plus size={14} />
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                                current.setDate(current.getDate() + 1);
                                            }
                                            return rows;
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                            )}

                            {(() => {
                                let totalMinutes = 0;
                                const journeys = employeeJourneys[employee.id] || [];
                                journeys.forEach(j => {
                                    totalMinutes += calculateDuration(j);
                                });
                                
                                const h = Math.floor(totalMinutes / 60);
                                const m = Math.round(totalMinutes % 60);

                                return (
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col md:flex-row justify-between items-center bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800/50 gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-brand-accent/10 border border-brand-accent/20 rounded-xl flex items-center justify-center">
                                                    <Clock className="text-brand-accent w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] leading-none">Total Consolidado</p>
                                                    <p className="text-xs font-bold text-white uppercase mt-1">Horas Realizadas</p>
                                                </div>
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-black text-brand-accent tracking-tighter">{h}h</span>
                                                <span className="text-xl font-black text-zinc-500 tracking-tighter">{m}m</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col md:flex-row justify-between items-center bg-zinc-950/20 p-5 rounded-2xl border border-dashed border-zinc-800/50 gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-zinc-800/50 border border-zinc-700/50 rounded-xl flex items-center justify-center">
                                                    <CalendarIcon className="text-zinc-500 w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] leading-none">Previsão Mensal</p>
                                                    <p className="text-xs font-bold text-zinc-400 uppercase mt-1">Estimativa de Jornada</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-2xl font-black text-zinc-600 tracking-tighter">08h-18h</span>
                                                <p className="text-[9px] font-bold text-zinc-700 uppercase">Segunda a Sexta (1.5h Almoço)</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="mt-8 pt-8 border-t border-zinc-800/50 grid grid-cols-1 md:grid-cols-2 gap-12 opacity-30 select-none grayscale cursor-not-allowed">
                                <div className="space-y-2">
                                    <div className="h-px bg-zinc-700 w-full" />
                                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center">Assinatura do Colaborador (Exclusivo PDF)</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-px bg-zinc-700 w-full" />
                                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center">Assinatura Gestor DM Turismo (Exclusivo PDF)</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingJourney(null);
                    setSelectedEmployee(null);
                }} 
                title={editingJourney ? "Ajustar Ponto" : "Lançamento Manual"}
            >
                <div className="space-y-6 p-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Data do Lançamento</label>
                            <input 
                                type="date" 
                                value={editData.date} 
                                onChange={e => handleDateChange(e.target.value)} 
                                className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white font-bold text-sm focus:border-brand-accent transition-colors" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Classificação</label>
                            <select 
                                value={editData.entryType}
                                onChange={e => handleEntryTypeChange(e.target.value as any)}
                                className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white font-bold text-sm focus:border-brand-accent transition-colors"
                            >
                                <option value="normal">Normal (Escala)</option>
                                <option value="overtime">Extra</option>
                                <option value="vacation">Férias</option>
                                <option value="day_off">Folga</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Entrada Efetiva</label>
                             <input 
                                type="datetime-local" 
                                value={editData.startTime} 
                                onChange={e => setEditData({...editData, startTime: e.target.value})} 
                                className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white font-bold text-sm focus:border-brand-accent transition-colors" 
                             />
                        </div>
                        <div className="space-y-2">
                             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">SAÍDA</label>
                             <input 
                                type="datetime-local" 
                                value={editData.endTime} 
                                onChange={e => setEditData({...editData, endTime: e.target.value})} 
                                className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white font-bold text-sm focus:border-brand-accent transition-colors" 
                             />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Saída Almoço</label>
                            <input 
                                type="datetime-local" 
                                value={editData.breakStart} 
                                onChange={e => setEditData({...editData, breakStart: e.target.value})} 
                                className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white font-bold text-sm focus:border-brand-accent transition-colors" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Retorno Almoço</label>
                            <input 
                                type="datetime-local" 
                                value={editData.breakEnd} 
                                onChange={e => setEditData({...editData, breakEnd: e.target.value})} 
                                className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-white font-bold text-sm focus:border-brand-accent transition-colors" 
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button 
                            onClick={saveEntry} 
                            className="flex-1 bg-brand-accent py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-white text-zinc-950 transition-all shadow-xl shadow-brand-accent/10"
                        >
                            <Save size={16} /> Salvar Ponto
                        </button>
                    </div>
                </div>
            </Modal>
            
            {isPreencherModalOpen && selectedEmployee && (
                <Modal 
                    isOpen={isPreencherModalOpen}
                    onClose={() => setIsPreencherModalOpen(false)}
                    title={`Preencher Cartão: ${selectedEmployee.name}`}
                >
                    <div className="space-y-6">
                        <Input 
                            label="Mês/Ano de Referência"
                            type="month"
                            value={preencherMonth}
                            onChange={(e: any) => setPreencherMonth(e.target.value)}
                        />
                        <Button 
                            variant="primary" 
                            onClick={async () => {
                                await handleAutoFillMonth(selectedEmployee, preencherMonth);
                                setIsPreencherModalOpen(false);
                            }}
                        >
                            Confirmar Preenchimento
                        </Button>
                    </div>
                </Modal>
            )}
            
            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, journey: null })}
                onConfirm={confirmDeleteJourney}
                title="Excluir Lançamento"
                message={`Deseja confirmar a exclusão deste registro?`}
            />
        </div>
    );
};

const parseDate = (dateStr: any): Date => {
    if (!dateStr) return new Date(NaN);
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        return new Date(Number(y), Number(m) - 1, Number(d));
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(NaN) : d;
};

