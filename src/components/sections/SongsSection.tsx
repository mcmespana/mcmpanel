import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Music, 
  ArrowLeft, 
  Edit, 
  GripVertical,
  Plus,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Song {
  author: string;
  capo: number;
  content: string;
  filename: string;
  info: string;
  key: string;
  title: string;
}

interface Category {
  categoryTitle: string;
  songs: Song[];
}

interface SongsData {
  data?: Record<string, Category>;
  updatedAt?: string;
}

interface SongsSectionProps {
  data: SongsData;
  onUpdate: (data: SongsData) => void;
}

type ViewMode = 'categories' | 'songs' | 'edit';

export function SongsSection({ data, onUpdate }: SongsSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingSongIndex, setEditingSongIndex] = useState<number>(-1);
  const [draggedIndex, setDraggedIndex] = useState<number>(-1);
  const { toast } = useToast();

  const categories = data?.data || {};
  const sortedCategories = Object.entries(categories).sort(([, a], [, b]) => 
    a.categoryTitle.localeCompare(b.categoryTitle)
  );

  const handleDownloadSongs = () => {
    const songsData = JSON.stringify(data, null, 2);
    const blob = new Blob([songsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `songs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Songs descargado",
      description: "El archivo songs.json se ha descargado exitosamente",
    });
  };

  const updateSongsData = (newData: Record<string, Category>) => {
    onUpdate({
      data: newData,
      updatedAt: new Date().toISOString()
    });
  };

  const reorderSongs = (categoryKey: string, fromIndex: number, toIndex: number) => {
    const newCategories = { ...categories };
    const songs = [...newCategories[categoryKey].songs];
    const [removed] = songs.splice(fromIndex, 1);
    songs.splice(toIndex, 0, removed);

    // Update the numbering based on new order
    songs.forEach((song, index) => {
      const currentNumber = String(index + 1).padStart(2, '0');
      const titleWithoutNumber = song.title.replace(/^\d+\.\s*/, '');
      song.title = `${currentNumber}. ${titleWithoutNumber}`;
    });

    newCategories[categoryKey].songs = songs;
    updateSongsData(newCategories);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== -1 && draggedIndex !== dropIndex) {
      reorderSongs(selectedCategory, draggedIndex, dropIndex);
    }
    setDraggedIndex(-1);
  };

  const saveSongEdit = () => {
    if (!editingSong || editingSongIndex === -1) return;

    const newCategories = { ...categories };
    newCategories[selectedCategory].songs[editingSongIndex] = { ...editingSong };
    updateSongsData(newCategories);

    toast({
      title: "Canción actualizada",
      description: "Los cambios se han guardado correctamente",
    });

    setEditingSong(null);
    setEditingSongIndex(-1);
    setViewMode('songs');
  };

  const addNewSong = () => {
    const newCategories = { ...categories };
    const songs = newCategories[selectedCategory].songs;
    const nextNumber = String(songs.length + 1).padStart(2, '0');
    
    const newSong: Song = {
      author: '',
      capo: 0,
      content: '',
      filename: '',
      info: '',
      key: 'C',
      title: `${nextNumber}. Nueva Canción`
    };

    newCategories[selectedCategory].songs.push(newSong);
    updateSongsData(newCategories);

    toast({
      title: "Nueva canción añadida",
      description: "Se ha creado una nueva canción en la categoría",
    });
  };

  const deleteSong = (songIndex: number) => {
    const newCategories = { ...categories };
    newCategories[selectedCategory].songs.splice(songIndex, 1);
    
    // Renumber remaining songs
    newCategories[selectedCategory].songs.forEach((song, index) => {
      const currentNumber = String(index + 1).padStart(2, '0');
      const titleWithoutNumber = song.title.replace(/^\d+\.\s*/, '');
      song.title = `${currentNumber}. ${titleWithoutNumber}`;
    });

    updateSongsData(newCategories);

    toast({
      title: "Canción eliminada",
      description: "La canción se ha eliminado de la categoría",
    });
  };

  if (viewMode === 'edit' && editingSong) {
    return (
      <div className="h-full bg-background/50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setViewMode('songs');
                  setEditingSong(null);
                  setEditingSongIndex(-1);
                }}
                className="tech-glow"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a canciones
              </Button>
              <h1 className="text-2xl font-bold text-foreground">
                Editar Canción
              </h1>
            </div>
            <div className="flex space-x-2">
              <Button onClick={saveSongEdit} className="tech-glow">
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </div>
          </div>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-tech">
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={editingSong.title}
                    onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author">Autor</Label>
                  <Input
                    id="author"
                    value={editingSong.author}
                    onChange={(e) => setEditingSong({ ...editingSong, author: e.target.value })}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key">Tonalidad</Label>
                  <Input
                    id="key"
                    value={editingSong.key}
                    onChange={(e) => setEditingSong({ ...editingSong, key: e.target.value })}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capo">Cejilla</Label>
                  <Input
                    id="capo"
                    type="number"
                    value={editingSong.capo}
                    onChange={(e) => setEditingSong({ ...editingSong, capo: parseInt(e.target.value) || 0 })}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filename">Nombre de archivo</Label>
                  <Input
                    id="filename"
                    value={editingSong.filename}
                    onChange={(e) => setEditingSong({ ...editingSong, filename: e.target.value })}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="info">Información</Label>
                  <Input
                    id="info"
                    value={editingSong.info}
                    onChange={(e) => setEditingSong({ ...editingSong, info: e.target.value })}
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Contenido de la canción</Label>
                <Textarea
                  id="content"
                  value={editingSong.content}
                  onChange={(e) => setEditingSong({ ...editingSong, content: e.target.value })}
                  className="min-h-[400px] bg-background/50 font-mono text-sm"
                  placeholder="Contenido de la canción con acordes..."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (viewMode === 'songs' && selectedCategory) {
    const categoryData = categories[selectedCategory];
    
    return (
      <div className="h-full bg-background/50 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setViewMode('categories')}
                className="tech-glow"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a categorías
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {categoryData.categoryTitle}
                </h1>
                <p className="text-muted-foreground">
                  {categoryData.songs.length} canciones
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={addNewSong} variant="outline" className="tech-glow">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Canción
              </Button>
            </div>
          </div>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-tech">
            <CardContent className="p-6">
              <div className="space-y-3">
                {categoryData.songs.map((song, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-200 cursor-move ${
                      draggedIndex === index 
                        ? 'border-primary/50 bg-primary/5' 
                        : 'border-border/50 bg-background/30 hover:bg-primary/5 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <GripVertical className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {song.title}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {song.author || 'Sin autor'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {song.key}
                          </Badge>
                          {song.capo > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Capo {song.capo}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingSong(song);
                          setEditingSongIndex(index);
                          setViewMode('edit');
                        }}
                        className="tech-glow"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSong(index)}
                        className="text-destructive hover:text-destructive tech-glow"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {categoryData.songs.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No hay canciones en esta categoría</p>
                    <p className="text-sm">Añade tu primera canción para comenzar</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background/50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Music className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Cantoral</h1>
              <p className="text-muted-foreground">
                Gestiona las canciones y categorías del cantoral
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleDownloadSongs} variant="outline" className="tech-glow">
              <Download className="w-4 h-4 mr-2" />
              Descargar Songs.json
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCategories.map(([categoryKey, category]) => (
            <Card 
              key={categoryKey}
              className="bg-card/50 backdrop-blur-sm border-border/50 shadow-tech hover:shadow-glow transition-all duration-200 cursor-pointer group"
              onClick={() => {
                setSelectedCategory(categoryKey);
                setViewMode('songs');
              }}
            >
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between text-foreground group-hover:text-primary transition-colors">
                  <span className="truncate">{category.categoryTitle}</span>
                  <Badge variant="secondary" className="ml-2 group-hover:bg-primary/10">
                    {category.songs.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {category.songs.length} canción{category.songs.length !== 1 ? 'es' : ''}
                  </p>
                  {category.songs.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Última: {category.songs[category.songs.length - 1]?.title || 'Sin título'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sortedCategories.length === 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-tech">
            <CardContent className="text-center py-12">
              <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No hay categorías disponibles</h3>
              <p className="text-muted-foreground">
                Importa un archivo JSON con datos de canciones para comenzar
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}