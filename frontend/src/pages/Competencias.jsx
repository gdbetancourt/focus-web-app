import React, { useState, useEffect } from 'react';
import { Target, Plus, Edit, Trash2, Save, X, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import api from '../lib/api';

// Default competencies based on the ones used in Blog
const DEFAULT_COMPETENCIES = [
  { name: 'Comunicación Efectiva', description: 'Habilidad para transmitir ideas de forma clara y persuasiva', color: 'blue' },
  { name: 'Pensamiento Crítico', description: 'Capacidad de análisis y evaluación objetiva', color: 'purple' },
  { name: 'Trabajo en Equipo', description: 'Colaboración efectiva con otros para lograr objetivos comunes', color: 'green' },
  { name: 'Resolución de Problemas', description: 'Identificar y solucionar desafíos de manera eficiente', color: 'orange' },
  { name: 'Creatividad e Innovación', description: 'Generar ideas nuevas y enfoques originales', color: 'pink' },
];

export default function Competencias() {
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCompetency, setEditingCompetency] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: 'blue' });

  useEffect(() => {
    loadCompetencies();
  }, []);

  const loadCompetencies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/foundations/competencias');
      if (res.data.competencias?.length > 0) {
        setCompetencies(res.data.competencias);
      } else {
        // Use defaults if none exist
        setCompetencies(DEFAULT_COMPETENCIES.map((c, i) => ({ ...c, id: `default-${i}` })));
      }
    } catch (error) {
      console.error('Error loading competencies:', error);
      // Use defaults on error
      setCompetencies(DEFAULT_COMPETENCIES.map((c, i) => ({ ...c, id: `default-${i}` })));
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingCompetency(null);
    setForm({ name: '', description: '', color: 'blue' });
    setShowDialog(true);
  };

  const openEditDialog = (comp) => {
    setEditingCompetency(comp);
    setForm({ name: comp.name, description: comp.description || '', color: comp.color || 'blue' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      if (editingCompetency) {
        await api.put(`/foundations/competencias/${editingCompetency.id}`, form);
        toast.success('Competencia actualizada');
      } else {
        await api.post('/foundations/competencias', form);
        toast.success('Competencia creada');
      }
      setShowDialog(false);
      loadCompetencies();
    } catch (error) {
      toast.error('Error guardando competencia');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta competencia?')) return;
    
    try {
      await api.delete(`/foundations/competencias/${id}`);
      toast.success('Competencia eliminada');
      loadCompetencies();
    } catch (error) {
      toast.error('Error eliminando competencia');
    }
  };

  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    teal: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  };

  return (
    <div className="space-y-6" data-testid="competencias-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20">
            <Target className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Competencias</h1>
            <p className="text-sm text-slate-500">Habilidades y competencias para el desarrollo profesional</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadCompetencies} variant="outline" className="border-[#333]">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Competencia
          </Button>
        </div>
      </div>

      {/* Competencies Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
          Cargando competencias...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competencies.map((comp) => (
            <Card key={comp.id} className="bg-[#111] border-[#222] hover:border-[#333] transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="outline" className={colorClasses[comp.color] || colorClasses.blue}>
                    {comp.name}
                  </Badge>
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      onClick={() => openEditDialog(comp)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                      onClick={() => handleDelete(comp.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-slate-400">{comp.description || 'Sin descripción'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCompetency ? 'Editar Competencia' : 'Nueva Competencia'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre de la competencia"
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Descripción</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción de la competencia"
                className="bg-[#0a0a0a] border-[#333]"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Color</label>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(colorClasses).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      form.color === color ? 'scale-110 ring-2 ring-white' : ''
                    } ${colorClasses[color]}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600">
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
