import { supabase } from './supabase';

export async function fetchMessages(conversationId) {
    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            reply_message:messages!reply_to(content, sender_id)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function sendMessage(conversationId, content, replyTo = null, imageUrl = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase
        .from('messages')
        .insert([
            {
                conversation_id: conversationId,
                sender_id: user.id,
                content: content.trim(),
                reply_to: replyTo || null,
                image_url: imageUrl || null,
            },
        ])
        .select(`
            *,
            reply_message:messages!reply_to(content, sender_id)
        `)
        .single();

    if (error) throw error;
    return data;
}

export async function markAsRead(conversationId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
}

export async function fetchUserConversations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: convs, error } = await supabase
        .from('conversations')
        .select(`
          *,
          listing:listings(title, photo_url),
          buyer_profile:profiles!buyer_id(*), 
          seller_profile:profiles!seller_id(*)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

    if (error) throw error;

    const conversationsWithCount = await Promise.all(convs.map(async (conv) => {
        const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

        return { ...conv, unread_count: count || 0 };
    }));

    return conversationsWithCount;
}

export async function reportContent(input) {
    const { data: { user } } = await supabase.auth.getUser();
    const reporterId = user?.id || null;

    const { error } = await supabase
        .from('reports')
        .insert([
            {
                reporter_id: reporterId,
                reported_user_id: input.reported_user_id,
                message_id: input.message_id || null,
                reason: input.reason,
                status: 'pending',
            },
        ]);

    if (error) throw error;
}
