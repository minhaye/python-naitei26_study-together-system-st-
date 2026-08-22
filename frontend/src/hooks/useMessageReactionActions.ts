import { useCallback } from 'react';
import { removeMessageReaction, setMessageReaction } from '../lib/message.api';
import type { Message, MessageReactionSummary } from '../lib/message.types';

/** Shared tap-an-emoji decision for all three chat surfaces (Channel, Study Room, Direct
 * Messages): if the viewer's current reaction on this message is already `emoji`, remove
 * it (toggle off); otherwise upsert it (add, or switch from a different emoji). Each
 * caller supplies its own `updateReactions` to patch whichever local message-list state
 * it owns -- this hook only owns the toggle rule and the API call, not the state shape.
 *
 * Failures are logged, not surfaced as a blocking error -- reacting is a low-stakes
 * engagement action, not core chat functionality. */
export function useMessageReactionActions(
  updateReactions: (messageId: string, reactions: MessageReactionSummary[]) => void
) {
  return useCallback(
    (message: Message, emoji: string) => {
      const mine = message.reactions.find((r) => r.reacted_by_me);
      const request = mine?.emoji === emoji ? removeMessageReaction(message.id) : setMessageReaction(message.id, emoji);
      request
        .then((reactions) => updateReactions(message.id, reactions))
        .catch((err) => console.warn('[Reactions] failed to update reaction for message', message.id, err));
    },
    [updateReactions]
  );
}
