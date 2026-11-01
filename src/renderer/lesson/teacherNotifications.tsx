import { useEffect, useRef, useState } from 'react';
import './teacherNotifications.css';

const noticeEvent = 'story-studio:teacher-notice';
type Notice = { id: number; message: string; key: string; expires: number };
/** Teacher window only: these events never enter the Present projection or IPC. */
export function notifyTeacher(message: string, key = message) {
  if (message.trim()) window.dispatchEvent(new CustomEvent(noticeEvent, { detail: { message, key } }));
}

/** Observe actual state changes, suppressing initial/project-loading noise. */
export function useTeacherChange(value: unknown, message: string, enabled = true, key = message, delay = 0) {
  const previous = useRef(value);
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    const changed = previous.current !== value;
    const announce = changed && enabled && wasEnabled.current;
    previous.current = value;
    wasEnabled.current = enabled;
    if (!announce || !message) return;
    const timer = window.setTimeout(() => notifyTeacher(message, key), delay);
    return () => window.clearTimeout(timer);
  }, [value, message, enabled, key, delay]);
}

export function TeacherNotifications({ activeStudent }: { activeStudent?: string }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [top, setTop] = useState(80);
  const serial = useRef(0);
  useEffect(() => {
    const header = document.querySelector('.lesson-header');
    const measure = () => setTop(Math.max(8, (header?.getBoundingClientRect().bottom ?? 68) + 12));
    measure();
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    window.addEventListener('resize', measure);
    const receive = (event: Event) => {
      const { message, key } = (event as CustomEvent<{ message: string; key: string }>).detail;
      setNotices(current => [...current.filter(item => item.key !== key && item.expires > Date.now()),
        { id: ++serial.current, message, key, expires: Date.now() + 3200 }].slice(-3));
    };
    window.addEventListener(noticeEvent, receive);
    const timer = window.setInterval(() => setNotices(current => current.some(item => item.expires <= Date.now()) ? current.filter(item => item.expires > Date.now()) : current), 200);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener(noticeEvent, receive); window.clearInterval(timer); };
  }, []);
  return <div className="teacher-feedback-dock" style={{ top }}>
    {activeStudent !== undefined && <div className="teacher-active-student" role="status" aria-label="Active reward recipient" title={`${activeStudent} · F1: next student`}>
      <span>Recipient</span><strong>{activeStudent}</strong>
    </div>}
    <aside className="teacher-notifications" aria-live="polite" aria-atomic="false" aria-label="Action notifications">
    {notices.map(notice => <div className="teacher-notification" key={notice.id}><span>{notice.message}</span><button type="button" aria-label={`Dismiss: ${notice.message}`} onClick={() => setNotices(current => current.filter(item => item.id !== notice.id))}>×</button></div>)}
  </aside></div>;
}
