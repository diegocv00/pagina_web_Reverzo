import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function UserProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(profileData || { full_name: user.email?.split('@')[0] || 'Usuario' });

        const { data: listingsData } = await supabase
          .from('listings')
          .select('*')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false });

        if (listingsData) {
          setListings(listingsData);
        }
      } else {
        window.location.href = '/auth';
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  const handleEditSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!user || !editName.trim()) return;
    setSavingEdit(true);
    try {
      let avatarUrlToSave = profile?.avatar_url || null;

      // Upload new avatar if selected
      if (editAvatarFile) {
        const fileExt = editAvatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, editAvatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        avatarUrlToSave = publicUrlData.publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          bio: editBio.trim(),
          avatar_url: avatarUrlToSave,
        })
        .eq('id', user.id);

      if (error) throw error;
      setProfile({ ...profile, full_name: editName.trim(), bio: editBio.trim(), avatar_url: avatarUrlToSave });
      setIsEditModalOpen(false);
      setEditAvatarFile(null);
      setEditAvatarPreview(null);
    } catch (error: any) {
      alert('Error al actualizar el perfil: ' + error.message);
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
        <div className="h-32 bg-primary/20 relative">
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-md overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-bg flex items-center justify-center text-primary/40">
                  <span className="material-icons text-5xl">person</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-16 pb-8 px-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-text">{profile?.full_name || 'Usuario'}</h2>
              {profile?.bio && <p className="text-sm text-muted mt-1">{profile.bio}</p>}
              <p className="text-muted text-sm">{user?.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditName(profile?.full_name || '');
                  setEditBio(profile?.bio || '');
                  setEditAvatarPreview(null);
                  setEditAvatarFile(null);
                  setIsEditModalOpen(true);
                }}
                className="bg-primary/10 text-primary font-bold px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors"
              >
                Editar perfil
              </button>
              <button
                onClick={handleLogout}
                className="bg-danger/10 text-danger font-bold px-4 py-2 rounded-xl hover:bg-danger/20 transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-6 grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-bg rounded-2xl">
              <p className="text-2xl font-bold text-primary">{listings.length}</p>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Publicados</p>
            </div>
            <div className="p-4 bg-bg rounded-2xl">
              <p className="text-2xl font-bold text-primary">{listings.filter(l => l.status === 'sold').length}</p>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Vendidos</p>
            </div>
            <div className="p-4 bg-bg rounded-2xl">
              <p className="text-2xl font-bold text-primary">5.0</p>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Calificación</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 mb-12">
        <h3 className="text-xl font-bold text-text mb-4">Mis libros publicados</h3>
        {listings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {listings.map(listing => (
              <div key={listing.id} onClick={() => window.location.href = `/libro?id=${listing.id}`} className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow group cursor-pointer">
                <div className="aspect-3/4 overflow-hidden relative">
                  <img
                    src={listing.photo_url || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=400&auto=format&fit=crop'}
                    alt={listing.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-text truncate">{listing.title}</h3>
                  <p className="text-sm text-muted mb-2 truncate">{listing.author}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-primary font-bold">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(listing.price)}
                    </span>
                    <span className="text-[10px] bg-bg px-2 py-0.5 rounded-full text-muted uppercase tracking-wider font-semibold">
                      {listing.condition || 'Usado'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-card rounded-2xl border border-border">
            <span className="material-icons text-4xl text-muted/30 mb-2">menu_book</span>
            <p className="text-muted">No has publicado ningún libro todavía.</p>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center bg-bg/50">
              <h3 className="font-bold text-text">Editar perfil</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-muted hover:text-danger"><span className="material-icons">close</span></button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-5">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="relative cursor-pointer" onClick={() => document.getElementById('avatarFileInput')?.click()}>
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border bg-bg flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                    {editAvatarPreview ? (
                      <img src={editAvatarPreview} alt="preview" className="w-full h-full object-cover" />
                    ) : profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <span className="material-icons text-2xl text-primary/50">add_a_photo</span>
                        <p className="text-[9px] font-bold text-muted uppercase">Foto</p>
                      </div>
                    )}
                  </div>
                  <input id="avatarFileInput" type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditAvatarFile(file);
                      setEditAvatarPreview(URL.createObjectURL(file));
                    }
                  }} />
                </div>
              </div>
              {/* Nombre */}
              <div>
                <label className="block text-sm font-bold text-text mb-2">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary outline-none bg-bg text-text"
                  placeholder="Tu nombre y apellido"
                />
              </div>
              {/* Bio */}
              <div>
                <label className="block text-sm font-bold text-text mb-2">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary outline-none bg-bg text-text h-24 resize-none"
                  placeholder="Cuéntanos sobre ti..."
                />
              </div>
              <button disabled={savingEdit || !editName.trim()} type="submit" className="w-full bg-primary hover:bg-primary-dark transition-colors text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {savingEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
