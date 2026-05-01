import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['Todos', '#Clásicos', '#Fantasía', '#Sci-Fi', '#Misterio', '#Terror', '#Romance', '#Poesía', '#Novela', '#Ensayo', '#Biografías', '#Historia', '#Filosofía', '#Psicología', '#Tecnología', '#Cómic', '#Manga'];

export default function CommunitiesList() {
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchText, setSearchText] = useState('');

  const [user, setUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberships, setMemberships] = useState<Record<string, boolean>>({});
  const [memberAvatars, setMemberAvatars] = useState<Record<string, any[]>>({});

  // Create form state
  const [form, setForm] = useState({
    name: '',
    topic: CATEGORIES[1],
    description: '',
    is_private: false,
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', data.user.id)
          .then(({ data: memData }) => {
            const memMap: Record<string, boolean> = {};
            memData?.forEach(m => memMap[m.community_id] = true);
            setMemberships(memMap);
          });
      }
    });

    async function loadCommunities() {
      setLoading(true);
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching communities:', error);
      } else {
        setCommunities(data || []);
        const avatarMap: Record<string, any[]> = {};
        await Promise.all((data || []).map(async (c: any) => {
          const { data: mems } = await supabase
            .from('community_members')
            .select('user_id')
            .eq('community_id', c.id)
            .limit(3);
          const members = [];
          for (const m of (mems || [])) {
            const { data: prof } = await supabase.from('profiles').select('avatar_url, full_name').eq('id', m.user_id).single();
            members.push({ user_id: m.user_id, profiles: prof });
          }
          avatarMap[c.id] = members;
        }));
        setMemberAvatars(avatarMap);
      }
      setLoading(false);
    }
    loadCommunities();
  }, []);

  const filteredCommunities = useMemo(() => {
    return communities.filter(item => {
      const matchesSearch = !searchText || item.name?.toLowerCase().includes(searchText.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || item.topic === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [communities, selectedCategory, searchText]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleJoin = async (communityId: string) => {
    if (!user) {
      alert("Debes iniciar sesión para unirte a una comunidad.");
      return;
    }
    try {
      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: user.id,
          role: 'member',
          status: 'approved'
        });

      if (error) throw error;
      setMemberships(prev => ({ ...prev, [communityId]: true }));
    } catch (err: any) {
      alert("Error al unirse: " + err.message);
    }
  };

  const handleCreate = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Debes iniciar sesión para crear una comunidad");
      return;
    }
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      let photo_url = '';
      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(filePath);

        photo_url = publicUrl;
      }

      // Insert community
      const { data: newCommunity, error: createError } = await supabase
        .from('communities')
        .insert({
          name: form.name.trim(),
          topic: form.topic,
          description: form.description.trim() || 'Sin descripción',
          is_private: form.is_private,
          photo_url: photo_url || null,
          creator_id: user.id
        })
        .select('*')
        .single();

      if (createError) throw createError;

      // Make creator an admin member automatically
      await supabase
        .from('community_members')
        .insert({
          community_id: newCommunity.id,
          user_id: user.id,
          role: 'admin',
          status: 'approved'
        });

      setCommunities(prev => [newCommunity, ...prev]);
      setIsModalOpen(false);
      setForm({ name: '', topic: CATEGORIES[1], description: '', is_private: false });
      setImage(null);
      setImagePreview(null);

    } catch (err: any) {
      alert('Error al crear la comunidad: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center bg-card rounded-xl border border-border px-4 py-2 grow max-w-xl">
          <span className="material-icons text-muted mr-2">search</span>
          <input
            type="text"
            placeholder="Buscar comunidades..."
            className="grow bg-transparent outline-none text-text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        {user && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-xl transition-colors flex items-center gap-2 shadow-sm ml-4 whitespace-nowrap"
          >
            <span className="material-icons text-sm">add</span>
            Crear
          </button>
        )}
      </div>

      <div className="mb-8">
        <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${selectedCategory === cat
                ? 'bg-primary text-white shadow-sm'
                : 'bg-card text-muted border border-border hover:border-primary/50'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredCommunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCommunities.map(community => (
            <div
              key={community.id}
              onClick={() => window.location.href = `/comunidad?id=${community.id}`}
              className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow p-4 flex gap-4 cursor-pointer"
            >
              <div className="w-20 h-20 rounded-xl bg-bg flex items-center justify-center shrink-0 overflow-hidden border border-border">
                {community.photo_url ? (
                  <img src={community.photo_url} alt={community.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-icons text-3xl text-primary/40">groups</span>
                )}
              </div>
              <div className="grow min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <h3 className="font-bold text-text truncate">{community.name}</h3>
                  {community.is_private && <span className="material-icons text-sm text-muted">lock</span>}
                </div>
                <p className="text-xs text-primary font-medium mb-2">{community.topic}</p>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex -space-x-2 items-center">
                    {(memberAvatars[community.id] || []).map((m: any) => (
                      <div key={m.user_id} title={m.profiles?.full_name || 'Usuario'} className="w-6 h-6 rounded-full border-2 border-card bg-bg overflow-hidden shrink-0 cursor-default">
                        {m.profiles?.avatar_url ? (
                          <img src={m.profiles.avatar_url} alt={m.profiles.full_name || ''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><span className="material-icons text-primary/30" style={{fontSize:'10px'}}>person</span></div>
                        )}
                      </div>
                    ))}
                    <span className="text-[10px] text-muted ml-4">+{community.member_count || 1}</span>
                  </div>
                  {memberships[community.id] ? (
                    <button
                      disabled
                      className="bg-card border border-border text-muted text-xs font-bold px-4 py-1.5 rounded-full"
                    >
                      Unido
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleJoin(community.id); }}
                      className="bg-primary/10 text-primary text-xs font-bold px-4 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors"
                    >
                      Unirse
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <span className="material-icons text-6xl text-muted/30 mb-4">groups_off</span>
          <p className="text-muted">No encontramos comunidades en esta categoría.</p>
        </div>
      )}

      {/* Modal Crear Comunidad */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-bg/50">
              <h2 className="text-xl font-bold text-text">Crear comunidad</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-danger transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="createCommunityForm" onSubmit={handleCreate} className="space-y-6">
                <div className="flex justify-center">
                  <div className="relative group cursor-pointer" onClick={() => document.getElementById('communityPhoto')?.click()}>
                    <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-border bg-bg flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
                      {imagePreview ? (
                        <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <div className="text-center">
                          <span className="material-icons text-3xl text-primary/50 mb-1">add_a_photo</span>
                          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Portada</p>
                        </div>
                      )}
                    </div>
                    <input id="communityPhoto" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Lectores de Fantasía"
                    className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-1">Categoría</label>
                  <select
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg"
                  >
                    {CATEGORIES.filter(c => c !== 'Todos').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between bg-bg p-4 rounded-xl border border-border">
                  <div>
                    <p className="font-bold text-text text-sm mb-1">Comunidad Privada</p>
                    <p className="text-xs text-muted">Requiere aprobación para nuevos miembros.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.is_private} onChange={(e) => setForm({ ...form, is_private: e.target.checked })} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-1">Descripción</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="¿De qué trata este club?"
                    className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-bg h-24 resize-none"
                  />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-border bg-bg/50">
              <button
                type="submit"
                form="createCommunityForm"
                disabled={saving || !form.name.trim()}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {saving ? 'Creando...' : 'Crear ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
