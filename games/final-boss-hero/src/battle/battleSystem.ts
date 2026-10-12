import type {
  BattleOutcome,
  BattleEffectsState,
  BattleResolutionSummary,
  BattleSettings,
  BattleState,
  MiniGameResult,
} from "../types/game";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createBattleState(settings: BattleSettings): BattleState {
  return {
    hero: {
      currentHp: clamp(settings.heroStartHp, 0, settings.heroMaxHp),
      maxHp: Math.max(1, settings.heroMaxHp),
      currentEnergy: clamp(settings.heroStartEnergy, 0, settings.heroMaxEnergy),
      maxEnergy: Math.max(0, settings.heroMaxEnergy),
    },
    villain: {
      currentHp: clamp(settings.villainStartHp, 0, settings.villainMaxHp),
      maxHp: Math.max(1, settings.villainMaxHp),
      currentEnergy: clamp(settings.villainStartEnergy, 0, settings.villainMaxEnergy),
      maxEnergy: Math.max(0, settings.villainMaxEnergy),
    },
    outcome: "active",
  };
}

function determineOutcome(heroHp: number, villainHp: number): BattleOutcome {
  if (heroHp <= 0 && villainHp <= 0) {
    return "draw";
  }
  if (villainHp <= 0) {
    return "heroVictory";
  }
  if (heroHp <= 0) {
    return "villainVictory";
  }
  return "active";
}

export function applyMiniGameResolution(
  battleState: BattleState,
  settings: BattleSettings,
  result: MiniGameResult,
  battleEffects?: Pick<BattleEffectsState, "shieldCharges">,
): { nextBattleState: BattleState; summary: BattleResolutionSummary } {
  const scoreDifference = Math.max(0, result.scoreDifference);
  const bonusDamage = scoreDifference * Math.max(0, settings.resolution.bonusDamagePerScore);
  const damageOnWin = Math.max(0, settings.resolution.baseDamage) + bonusDamage;
  const drawDamage = Math.max(0, settings.resolution.drawDamage);
  const energyCost = Math.max(0, settings.resolution.participationEnergyCost);
  const winnerEnergyGain = Math.max(0, settings.resolution.winnerEnergyGain);
  const loserEnergyLoss = Math.max(0, settings.resolution.loserEnergyLoss);
  const drawEnergyGain = Math.max(0, settings.resolution.drawEnergyGain);

  let damageToHero = 0;
  let damageToVillain = 0;
  let heroEnergyDelta = -energyCost;
  let villainEnergyDelta = -energyCost;

  if (result.winner === "hero") {
    damageToVillain = damageOnWin;
    heroEnergyDelta += winnerEnergyGain;
    villainEnergyDelta -= loserEnergyLoss;
  } else if (result.winner === "villain") {
    damageToHero = damageOnWin;
    villainEnergyDelta += winnerEnergyGain;
    heroEnergyDelta -= loserEnergyLoss;
  } else {
    damageToHero = drawDamage;
    damageToVillain = drawDamage;
    heroEnergyDelta += drawEnergyGain;
    villainEnergyDelta += drawEnergyGain;
  }

  const heroShieldAvailable = Math.max(0, battleEffects?.shieldCharges.hero ?? 0);
  const villainShieldAvailable = Math.max(0, battleEffects?.shieldCharges.villain ?? 0);
  const blockedDamageToHero = damageToHero > 0 && heroShieldAvailable > 0 ? damageToHero : 0;
  const blockedDamageToVillain = damageToVillain > 0 && villainShieldAvailable > 0 ? damageToVillain : 0;
  damageToHero -= blockedDamageToHero;
  damageToVillain -= blockedDamageToVillain;

  const nextHeroHp = clamp(battleState.hero.currentHp - damageToHero, 0, battleState.hero.maxHp);
  const nextVillainHp = clamp(
    battleState.villain.currentHp - damageToVillain,
    0,
    battleState.villain.maxHp,
  );
  const nextHeroEnergy = clamp(
    battleState.hero.currentEnergy + heroEnergyDelta,
    0,
    battleState.hero.maxEnergy,
  );
  const nextVillainEnergy = clamp(
    battleState.villain.currentEnergy + villainEnergyDelta,
    0,
    battleState.villain.maxEnergy,
  );

  return {
    nextBattleState: {
      hero: {
        ...battleState.hero,
        currentHp: nextHeroHp,
        currentEnergy: nextHeroEnergy,
      },
      villain: {
        ...battleState.villain,
        currentHp: nextVillainHp,
        currentEnergy: nextVillainEnergy,
      },
      outcome: determineOutcome(nextHeroHp, nextVillainHp),
    },
    summary: {
      damageToHero,
      damageToVillain,
      blockedDamageToHero,
      blockedDamageToVillain,
      heroEnergyDelta: nextHeroEnergy - battleState.hero.currentEnergy,
      villainEnergyDelta: nextVillainEnergy - battleState.villain.currentEnergy,
      winner: result.winner,
    },
  };
}
