import { supabase } from './supabase';

export async function fetchFavoriteIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching favorite ids:', error);
    throw error;
  }
  return (data ?? []).map((f: any) => String(f.listing_id));
}

export async function fetchFavorites(): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('favorites')
    .select('listing_id, listing:listings(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching favorites:', error);
    throw error;
  }
  return (data ?? []).map((f: any) => f.listing || f.listings).filter(Boolean);
}

export async function toggleFavorite(listingId: string, isFav: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  if (isFav) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', listingId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert([{ user_id: user.id, listing_id: listingId }]);
    if (error) throw error;
  }
}
