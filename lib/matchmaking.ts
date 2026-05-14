import { supabase } from './supabase';

export interface MatchmakingParams {
  playerId: string;
  gameType: string;
  stake: number;
  maxPlayers: number;
}

export const MatchmakingService = {
  /**
   * Enters the queue and scans for existing rooms or creates a new one
   */
  async findMatch(params: MatchmakingParams) {
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: rooms, error: searchError } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('game_type', params.gameType)
      .eq('stake', params.stake)
      .eq('max_players', params.maxPlayers)
      .eq('status', 'waiting')
      .eq('is_private', false)
      .gt('updated_at', twoMinsAgo)
      .limit(1);

    if (searchError) {
      console.error("Matchmaking Search Error:", searchError.message, searchError.details);
    }

    if (rooms && rooms.length > 0) {
      const room = rooms[0];
      const players = [...(room.players || [])];
      
      // Join if not already in
      if (!players.find((p: any) => p.id === params.playerId)) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', params.playerId).single();
        
        const colors = params.maxPlayers === 2 ? ['green', 'red'] : ['green', 'yellow', 'red', 'blue'];
        const assignedColor = colors[players.length];

        players.push({ 
          id: params.playerId, 
          username: profile?.username || 'Player',
          color: assignedColor,
          ready: false 
        });

        const updates: any = { players };
        if (players.length === params.maxPlayers) {
          updates.status = 'starting';
        }

        const { error } = await supabase
          .from('game_rooms')
          .update(updates)
          .eq('id', room.id);
        
        if (!error) {
          // Update queue entry with room_id
          await supabase.from('matchmaking_queue').update({ room_id: room.id }).eq('player_id', params.playerId);
          return room.id;
        } else {
          console.error("Matchmaking Join Error:", error.message, error.details);
        }
      }
    }

    // 2. No room found? Create one
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', params.playerId).single();
    const { data: newRoom, error: createError } = await supabase
      .from('game_rooms')
      .insert({
        game_type: params.gameType,
        stake: params.stake,
        max_players: params.maxPlayers,
        host_id: params.playerId,
        players: [{ id: params.playerId, username: profile?.username || 'Player', color: 'green', ready: true }],
        status: 'waiting'
      })
      .select()
      .single();

    if (createError) {
      console.error("Matchmaking Create Error:", createError.message, createError.details);
      return null;
    }
    
    const { error: queueError } = await supabase.from('matchmaking_queue').update({ room_id: newRoom.id }).eq('player_id', params.playerId);
    
    if (queueError) {
      console.error("Matchmaking Queue Update Error:", queueError.message, queueError.details);
    }

    return newRoom.id;
  }
};
