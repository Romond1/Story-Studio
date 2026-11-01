import type { TeamScoreboard } from '../../shared/teamPlay/scoreboard';
import './teamScoreboard.css';

export function TeamScoreboardOverlay({scoreboard}:{scoreboard:TeamScoreboard}) {
  return <aside className="team-scoreboard-overlay" aria-label="Team Play scoreboard" aria-live="polite">
    <strong>{scoreboard.name} · ◆ Team {scoreboard.score} / {scoreboard.target}</strong>
    <span>Objectives {scoreboard.completed} / {scoreboard.objectives}</span>
    <progress aria-label="Team progress" max={scoreboard.target} value={Math.min(scoreboard.score,scoreboard.target)}/>
    <div className="team-scoreboard-students">{scoreboard.students.map((student,index)=><span key={index} style={{borderColor:student.color}}>{student.name}{student.participating?'':' (away)'} <b>{student.score}</b></span>)}</div>
  </aside>;
}
