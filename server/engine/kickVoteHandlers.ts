import { KickVoteState } from '../../shared/types.ts';
import { EngineHost, logAvatarBadge, ServerRoom } from './engineUtils.ts';

export function startKickVote(host: EngineHost, 
    room: ServerRoom,
    initiatorId: string,
    targetId: string
  ): { ok: boolean; error?: string } {
    if (room.state.status !== 'PLAYING') {
      return { ok: false, error: 'Голосование доступно только во время игры' };
    }
    if (room.state.activeKickVote) {
      return { ok: false, error: 'Уже идёт другое голосование за кик' };
    }
    const initiator = room.state.players.find((p) => p.id === initiatorId);
    const target = room.state.players.find((p) => p.id === targetId);
    if (!initiator || initiator.isBankrupt || !target || target.isBankrupt || initiatorId === targetId) {
      return { ok: false, error: 'Некорректная цель для кика' };
    }

    const eligible = room.state.players.filter((p) => !p.isBankrupt && p.id !== targetId);
    if (eligible.length < 2) {
      return { ok: false, error: 'Голосование за кик доступно при 3 и более активных игроках' };
    }

    const vote: KickVoteState = {
      initiatorId,
      targetId,
      votes: { [initiatorId]: true },
      eligibleVoterIds: eligible.map((p) => p.id),
      expiresAt: Date.now() + 30_000,
    };
    room.state.activeKickVote = vote;

    const targetBadge = logAvatarBadge(target.avatar);
    host.addLog(
      room,
      'SYSTEM',
      `🗳️ ${initiator.name} запустил голосование за кик ${targetBadge} ${target.name} (${target.name} не голосует)!`,
      `🗳️ Запущено голосование за кик ${targetBadge} ${target.name}.`
    );
    host.emitState(room);
    return { ok: true };
  }

export function castKickVote(host: EngineHost, 
    room: ServerRoom,
    playerId: string,
    approve: boolean
  ): { ok: boolean; error?: string } {
    const vote = room.state.activeKickVote;
    if (!vote || room.state.status !== 'PLAYING') {
      return { ok: false, error: 'Нет активного голосования' };
    }
    if (playerId === vote.targetId || !vote.eligibleVoterIds.includes(playerId)) {
      return { ok: false, error: 'Игрок, против которого идёт голосование, не может голосовать' };
    }

    vote.votes[playerId] = Boolean(approve);
    evaluateKickVoteProgress(host, room);
    return { ok: true };
  }

export function evaluateKickVoteProgress(host: EngineHost, room: ServerRoom) {
    const vote = room.state.activeKickVote;
    if (!vote) return;
    const totalEligible = vote.eligibleVoterIds.length;
    if (totalEligible < 2) {
      resolveKickVote(host, room, false, 'недостаточно голосующих');
      return;
    }

    const neededYes = Math.floor(totalEligible / 2) + 1;
    let yesCount = 0;
    let noCount = 0;
    for (const vid of vote.eligibleVoterIds) {
      if (vote.votes[vid] === true) yesCount++;
      else if (vote.votes[vid] === false) noCount++;
    }

    if (yesCount >= neededYes) {
      resolveKickVote(host, room, true, `${yesCount}/${totalEligible}`);
      return;
    }

    const maxPossibleYes = totalEligible - noCount;
    if (maxPossibleYes < neededYes || yesCount + noCount >= totalEligible) {
      resolveKickVote(host, room, false, `${yesCount}/${totalEligible}`);
      return;
    }

    host.emitState(room);
  }

export function resolveKickVote(host: EngineHost, room: ServerRoom, passed: boolean, details: string) {
    const vote = room.state.activeKickVote;
    if (!vote) return;
    room.state.activeKickVote = null;

    const target = room.state.players.find((p) => p.id === vote.targetId);
    if (passed && target && !target.isBankrupt) {
      const targetBadge = logAvatarBadge(target.avatar);
      host.addLog(
        room,
        'SYSTEM',
        `👢 Голосование принято (${details}): ${targetBadge} ${target.name} отправляется на завод!`,
        `👢 Голосование принято (${details}): ${targetBadge} ${target.name} кикнут из матча.`
      );
      host.executeBankruptcy(
        room,
        target,
        'BANK',
        'Кикнут голосованием большинства игроков',
        'Исключён голосованием игроков'
      );
    } else {
      host.addLog(
        room,
        'SYSTEM',
        `🙅 Голосование за кик ${target?.name ?? 'игрока'} провалилось (${details}).`,
        `🙅 Кик ${target?.name ?? 'игрока'} отклонён (${details}).`
      );
    }
    host.emitState(room);
  }

