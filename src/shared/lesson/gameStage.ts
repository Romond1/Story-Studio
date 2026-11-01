/** Passive visual metadata shared by every game stage; no hidden activity mapping. */
export interface GameReveal {id:string;startedAt:number;durationMs:number;variant:number;selectedIndex?:number}
export interface MysterySlot {id:string;index:number;selected:boolean;used:boolean}
export interface GameShuffle {id:string;startedAt:number;durationMs:number}
