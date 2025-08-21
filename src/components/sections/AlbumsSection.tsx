import { useState } from 'react';
import { Plus, Edit3, Trash2, Move, Save, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Album {
  id: string;
  title: string;
  albumUrl: string;
  imageUrl: string;
  date: string;
  location: string;
}

interface AlbumsSectionProps {
  data: any;
  onUpdate: (data: any) => void;
}

export function AlbumsSection({ data, onUpdate }: AlbumsSectionProps) {
  const [albums, setAlbums] = useState<Album[]>(data?.data || []);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const saveChanges = () => {
    onUpdate({
      data: albums,
      updatedAt: new Date().toISOString()
    });
  };

  const handleCreateAlbum = () => {
    const newId = Math.max(...albums.map(a => parseInt(a.id)), 0) + 1;
    const newAlbum: Album = {
      id: newId.toString(),
      title: '',
      albumUrl: '',
      imageUrl: '',
      date: '',
      location: ''
    };
    setEditingAlbum(newAlbum);
    setIsCreating(true);
  };

  const handleSaveAlbum = (album: Album) => {
    if (isCreating) {
      setAlbums([...albums, album]);
    } else {
      setAlbums(albums.map(a => a.id === album.id ? album : a));
    }
    setEditingAlbum(null);
    setIsCreating(false);
  };

  const handleDeleteAlbum = (id: string) => {
    setAlbums(albums.filter(a => a.id !== id));
    toast({
      title: "Álbum eliminado",
      description: "El álbum se ha eliminado correctamente",
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newAlbums = [...albums];
    const draggedAlbum = newAlbums[draggedIndex];
    newAlbums.splice(draggedIndex, 1);
    newAlbums.splice(index, 0, draggedAlbum);

    // Reorder IDs
    newAlbums.forEach((album, idx) => {
      album.id = idx.toString();
    });

    setAlbums(newAlbums);
    setDraggedIndex(index);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Gestión de Álbumes
          </h2>
          <p className="text-muted-foreground mt-1">
            Última actualización: {data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString('es-ES') : 'No disponible'}
          </p>
        </div>
        
        <div className="flex space-x-3">
          <Button onClick={handleCreateAlbum} className="tech-glow">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Álbum
          </Button>
          <Button onClick={saveChanges} variant="outline" className="tech-glow">
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {albums.length === 0 ? (
          <Card className="p-8 text-center bg-card/50 border-border/50">
            <p className="text-muted-foreground">No hay álbumes configurados</p>
          </Card>
        ) : (
          albums.map((album, index) => (
            <Card
              key={album.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={() => setDraggedIndex(null)}
              className="p-4 bg-card/50 border-border/50 cursor-move hover:bg-card/70 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Move className="w-5 h-5 text-muted-foreground" />
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-sm font-mono">
                    #{album.id}
                  </div>
                  <div>
                    <h3 className="font-semibold">{album.title || 'Sin título'}</h3>
                    <p className="text-sm text-muted-foreground">{album.location || 'Sin ubicación'}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {album.albumUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={album.albumUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingAlbum(album)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <AlbumEditor
                        album={editingAlbum}
                        onSave={handleSaveAlbum}
                        onCancel={() => setEditingAlbum(null)}
                      />
                    </DialogContent>
                  </Dialog>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteAlbum(album.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {editingAlbum && (
        <Dialog open={!!editingAlbum} onOpenChange={() => setEditingAlbum(null)}>
          <DialogContent className="max-w-md">
            <AlbumEditor
              album={editingAlbum}
              onSave={handleSaveAlbum}
              onCancel={() => setEditingAlbum(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface AlbumEditorProps {
  album: Album | null;
  onSave: (album: Album) => void;
  onCancel: () => void;
}

function AlbumEditor({ album, onSave, onCancel }: AlbumEditorProps) {
  const [formData, setFormData] = useState<Album>(
    album || {
      id: '',
      title: '',
      albumUrl: '',
      imageUrl: '',
      date: '',
      location: ''
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field: keyof Album, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Edit3 className="w-5 h-5" />
          <span>{album?.id ? 'Editar Álbum' : 'Nuevo Álbum'}</span>
        </DialogTitle>
      </DialogHeader>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Nombre del álbum"
          />
        </div>
        
        <div>
          <Label htmlFor="albumUrl">URL del Álbum</Label>
          <Input
            id="albumUrl"
            value={formData.albumUrl}
            onChange={(e) => handleChange('albumUrl', e.target.value)}
            placeholder="https://photos.app.goo.gl/..."
          />
        </div>
        
        <div>
          <Label htmlFor="imageUrl">URL de la Imagen</Label>
          <Input
            id="imageUrl"
            value={formData.imageUrl}
            onChange={(e) => handleChange('imageUrl', e.target.value)}
            placeholder="https://firebasestorage.googleapis.com/..."
          />
        </div>
        
        <div>
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            value={formData.date}
            onChange={(e) => handleChange('date', e.target.value)}
            placeholder="Fecha del evento"
          />
        </div>
        
        <div>
          <Label htmlFor="location">Ubicación</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="Ciudad, país"
          />
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button type="submit" className="tech-glow">
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </div>
      </form>
    </>
  );
}