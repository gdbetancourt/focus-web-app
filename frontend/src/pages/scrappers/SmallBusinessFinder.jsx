import React, { useState, useEffect } from 'react';
import { MapPin, Search, Building, Star, Phone, Globe, RefreshCw, ExternalLink, History, Clock, Calendar, CheckCircle2, AlertCircle, Trash2, Download, Plus, Play, ListOrdered, Pause } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import api from '../../lib/api';
import ApifyStatusAlert from '../../components/ApifyStatusAlert';

const SmallBusinessFinder = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  
  // Search Queue state
  const [searchQueue, setSearchQueue] = useState([]);
  const [isRunningQueue, setIsRunningQueue] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);

  useEffect(() => {
    loadData();
    loadSearchQueue();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [businessesRes, runsRes, schedulesRes, summaryRes] = await Promise.all([
        api.get('/scrappers/small-business', { params: { limit: 100 } }),
        api.get('/scrappers/logs/runs?scrapper_id=small_business_maps&limit=20'),
        api.get('/scheduler/schedules?schedule_type=small_business').catch(() => ({ data: { schedules: [] } })),
        api.get('/scheduler/summary/small_business_maps').catch(() => ({ data: {} }))
      ]);
      
      setResults(businessesRes.data.businesses || []);
      setRecentRuns(runsRes.data.runs || []);
      setSchedules(schedulesRes.data.schedules || []);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading businesses');
    } finally {
      setLoading(false);
    }
  };

  // Load search queue from localStorage
  const loadSearchQueue = () => {
    try {
      const saved = localStorage.getItem('smallBusinessSearchQueue');
      if (saved) {
        setSearchQueue(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading search queue:', e);
    }
  };

  // Save search queue to localStorage
  const saveSearchQueue = (queue) => {
    try {
      localStorage.setItem('smallBusinessSearchQueue', JSON.stringify(queue));
    } catch (e) {
      console.error('Error saving search queue:', e);
    }
  };

  // Add search to queue without executing
  const addToQueue = () => {
    if (!searchQuery.trim() || !location.trim()) {
      toast.error('Ingresa tipo de negocio y ciudad');
      return;
    }
    
    // Check for duplicates in queue
    const exists = searchQueue.some(
      item => item.query.toLowerCase() === searchQuery.toLowerCase() && 
              item.location.toLowerCase() === location.toLowerCase()
    );
    
    if (exists) {
      toast.error('Esta búsqueda ya está en la cola');
      return;
    }
    
    const newItem = {
      id: Date.now().toString(),
      query: searchQuery.trim(),
      location: location.trim(),
      status: 'pending',
      addedAt: new Date().toISOString()
    };
    
    const newQueue = [...searchQueue, newItem];
    setSearchQueue(newQueue);
    saveSearchQueue(newQueue);
    
    toast.success(`"${searchQuery} en ${location}" añadido a la cola`);
    setSearchQuery('');
    setLocation('');
  };

  // Remove item from queue
  const removeFromQueue = (id) => {
    const newQueue = searchQueue.filter(item => item.id !== id);
    setSearchQueue(newQueue);
    saveSearchQueue(newQueue);
    toast.success('Búsqueda eliminada de la cola');
  };

  // Clear entire queue
  const clearQueue = () => {
    setSearchQueue([]);
    saveSearchQueue([]);
    toast.success('Cola vaciada');
  };

  // Execute a single search from queue
  const executeQueueItem = async (item, index) => {
    setCurrentQueueIndex(index);
    
    // Update item status to running
    const updatedQueue = searchQueue.map(q => 
      q.id === item.id ? { ...q, status: 'running' } : q
    );
    setSearchQueue(updatedQueue);
    saveSearchQueue(updatedQueue);
    
    try {
      const response = await api.post('/scrappers/search/small-business', null, {
        params: {
          business_type: item.query,
          city: item.location,
          limit: 50
        }
      });
      
      if (response.data.success) {
        // Create schedule for future runs
        const scheduleKey = `${item.query.toLowerCase().replace(/\s+/g, '_')}_${item.location.toLowerCase().replace(/\s+/g, '_')}`;
        await api.post('/scheduler/schedules', {
          schedule_type: 'small_business',
          entity_id: scheduleKey,
          entity_name: `${item.query} in ${item.location}`,
          frequency: 'quarterly',
          params: { business_type: item.query, city: item.location }
        }).catch(() => {}); // Ignore if schedule already exists
        
        // Update item status to completed
        const completedQueue = searchQueue.map(q => 
          q.id === item.id ? { ...q, status: 'completed', completedAt: new Date().toISOString() } : q
        );
        setSearchQueue(completedQueue);
        saveSearchQueue(completedQueue);
        
        return true;
      }
    } catch (error) {
      console.error('Error executing search:', error);
      
      // Update item status to failed
      const failedQueue = searchQueue.map(q => 
        q.id === item.id ? { ...q, status: 'failed', error: error.message } : q
      );
      setSearchQueue(failedQueue);
      saveSearchQueue(failedQueue);
      
      return false;
    }
    
    return false;
  };

  // Run entire queue sequentially
  const runQueue = async () => {
    const pendingItems = searchQueue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
      toast.error('No hay búsquedas pendientes en la cola');
      return;
    }
    
    setIsRunningQueue(true);
    toast.info(`Ejecutando ${pendingItems.length} búsquedas...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const success = await executeQueueItem(item, i);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Small delay between searches to avoid rate limiting
      if (i < pendingItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    setIsRunningQueue(false);
    setCurrentQueueIndex(-1);
    
    // Remove completed items from queue
    const remainingQueue = searchQueue.filter(item => item.status !== 'completed');
    setSearchQueue(remainingQueue);
    saveSearchQueue(remainingQueue);
    
    // Reload data
    setTimeout(() => loadData(), 2000);
    
    toast.success(`Cola completada: ${successCount} exitosas, ${failCount} fallidas`);
  };

  // Direct search (execute immediately)
  const handleSearch = async () => {
    if (!searchQuery.trim() || !location.trim()) {
      toast.error('Please enter both business type and location');
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await api.post('/scrappers/search/small-business', null, {
        params: {
          business_type: searchQuery,
          city: location,
          limit: 50
        }
      });
      
      if (response.data.success) {
        toast.success(`Search started! Looking for "${searchQuery}" in ${location}`);
        
        // Create schedule for this search (every 90 days)
        const scheduleKey = `${searchQuery.toLowerCase().replace(/\s+/g, '_')}_${location.toLowerCase().replace(/\s+/g, '_')}`;
        await api.post('/scheduler/schedules', {
          schedule_type: 'small_business',
          entity_id: scheduleKey,
          entity_name: `${searchQuery} in ${location}`,
          frequency: 'quarterly',
          params: { business_type: searchQuery, city: location }
        });
        
        setSearchQuery('');
        setLocation('');
        setTimeout(() => loadData(), 3000);
      }
    } catch (error) {
      console.error('Error starting search:', error);
      toast.error('Failed to start search');
    } finally {
      setIsSearching(false);
    }
  };

  // Format date for display
  const formatDate = (isoDate) => {
    if (!isoDate) return 'Never';
    const date = new Date(isoDate);
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  // Calculate days until next run
  const getDaysUntil = (isoDate) => {
    if (!isoDate) return null;
    const next = new Date(isoDate);
    const now = new Date();
    const diff = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const deleteSchedule = async (scheduleId) => {
    try {
      await api.delete(`/scheduler/schedules/${scheduleId}`);
      toast.success('Schedule deleted');
      loadData();
    } catch (error) {
      toast.error('Error deleting schedule');
    }
  };

  const exportToCSV = () => {
    if (results.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Name', 'Address', 'Phone', 'Website', 'Rating', 'Reviews', 'Category', 'City'];
    const rows = results.map(b => [
      b.name || '',
      b.address || '',
      b.phone || '',
      b.website || '',
      b.rating || '',
      b.reviews_count || '',
      b.category || '',
      b.city || ''
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `businesses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${results.length} businesses`);
  };

  // Get queue status counts
  const queueStats = {
    pending: searchQueue.filter(q => q.status === 'pending').length,
    running: searchQueue.filter(q => q.status === 'running').length,
    completed: searchQueue.filter(q => q.status === 'completed').length,
    failed: searchQueue.filter(q => q.status === 'failed').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="small-business-finder-page">
      {/* Apify Status Alert */}
      <ApifyStatusAlert />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-500/20">
            <MapPin className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Small Business Finder</h1>
            <p className="text-slate-500">
              Find local businesses using Google Maps data scraping
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" className="border-[#333] text-slate-300">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={loadData} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{results.length}</div>
            <div className="text-xs text-slate-500">Total Businesses</div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{summary?.total_deal_makers_found || 0}</div>
            <div className="text-xs text-slate-500">Contacts Found</div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{schedules.length}</div>
            <div className="text-xs text-slate-500">Scheduled Searches</div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-400">{queueStats.pending}</div>
            <div className="text-xs text-slate-500">En Cola</div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{summary?.successful_searches || 0}</div>
            <div className="text-xs text-slate-500">Successful Searches</div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-green-500/10 border-green-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Clock className="w-4 h-4" />
            Searches are automatically repeated every 90 days. Contacts are added to Deal Makers (1.3.1).
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="search" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <Search className="w-4 h-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="queue" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
            <ListOrdered className="w-4 h-4 mr-2" />
            Cola ({queueStats.pending})
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <Clock className="w-4 h-4 mr-2" />
            Scheduled ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="recent" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <History className="w-4 h-4 mr-2" />
            Recent ({recentRuns.length})
          </TabsTrigger>
          <TabsTrigger value="results" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <Building className="w-4 h-4 mr-2" />
            Results ({results.length})
          </TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-green-500" />
                Business Search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Tipo de negocio o keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0a0a0a] border-[#333] text-white"
                  data-testid="business-search-input"
                />
                <Input
                  placeholder="Ciudad (ej: Guadalajara, CDMX...)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="bg-[#0a0a0a] border-[#333] text-white"
                  data-testid="city-input"
                />
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={addToQueue}
                  disabled={!searchQuery.trim() || !location.trim()}
                  variant="outline"
                  className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                  data-testid="add-to-queue-btn"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir a Cola
                </Button>
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim() || !location.trim()}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="search-business-btn"
                >
                  {isSearching ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Buscar Ahora
                    </>
                  )}
                </Button>
              </div>
              
              {/* Quick search suggestions */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500">Búsquedas rápidas:</span>
                {['Clínicas', 'Farmacias', 'Hospitales', 'Laboratorios', 'Equipo Médico'].map(term => (
                  <Badge 
                    key={term}
                    className="bg-[#222] text-slate-300 hover:bg-[#333] cursor-pointer"
                    onClick={() => setSearchQuery(term)}
                  >
                    {term}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Tab - NEW */}
        <TabsContent value="queue" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-yellow-500" />
                  Cola de Búsqueda
                </span>
                <div className="flex gap-2">
                  {queueStats.pending > 0 && (
                    <>
                      <Button
                        onClick={runQueue}
                        disabled={isRunningQueue}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="run-queue-btn"
                      >
                        {isRunningQueue ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Ejecutando...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Ejecutar Cola ({queueStats.pending})
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={clearQueue}
                        disabled={isRunningQueue}
                        variant="outline"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Vaciar
                      </Button>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {searchQueue.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ListOrdered className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>La cola está vacía.</p>
                  <p className="text-sm mt-2">Usa "Añadir a Cola" en la pestaña Search para agregar búsquedas.</p>
                </div>
              ) : (
                <>
                  {/* Queue stats */}
                  <div className="flex gap-4 mb-4 pb-4 border-b border-[#222]">
                    <div className="text-sm">
                      <span className="text-slate-500">Pendientes: </span>
                      <span className="text-yellow-400 font-medium">{queueStats.pending}</span>
                    </div>
                    {queueStats.running > 0 && (
                      <div className="text-sm">
                        <span className="text-slate-500">Ejecutando: </span>
                        <span className="text-blue-400 font-medium">{queueStats.running}</span>
                      </div>
                    )}
                    {queueStats.completed > 0 && (
                      <div className="text-sm">
                        <span className="text-slate-500">Completadas: </span>
                        <span className="text-green-400 font-medium">{queueStats.completed}</span>
                      </div>
                    )}
                    {queueStats.failed > 0 && (
                      <div className="text-sm">
                        <span className="text-slate-500">Fallidas: </span>
                        <span className="text-red-400 font-medium">{queueStats.failed}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Queue items */}
                  {searchQueue.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        item.status === 'running' 
                          ? 'border-blue-500/50 bg-blue-500/10' 
                          : item.status === 'completed'
                          ? 'border-green-500/50 bg-green-500/10'
                          : item.status === 'failed'
                          ? 'border-red-500/50 bg-red-500/10'
                          : 'border-[#222] bg-[#0a0a0a]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          item.status === 'running' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : item.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : item.status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {item.status === 'running' ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : item.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : item.status === 'failed' ? (
                            <AlertCircle className="w-4 h-4" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div>
                          <div className="text-white font-medium">{item.query}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${
                          item.status === 'running' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : item.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : item.status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {item.status === 'pending' ? 'Pendiente' : 
                           item.status === 'running' ? 'Ejecutando' :
                           item.status === 'completed' ? 'Completado' : 'Fallido'}
                        </Badge>
                        {item.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromQueue(item.id)}
                            disabled={isRunningQueue}
                            className="text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Tab */}
        <TabsContent value="scheduled" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-500" />
                Búsquedas Programadas (Cada 90 días)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {schedules.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No hay búsquedas programadas. Ejecuta una búsqueda para crear un schedule.</p>
                </div>
              ) : (
                schedules.map(schedule => {
                  const daysUntil = getDaysUntil(schedule.next_run);
                  return (
                    <div key={schedule.id} className="flex items-center justify-between p-4 border border-[#222] rounded-lg bg-[#0a0a0a]">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-green-500" />
                        <div>
                          <div className="text-white font-medium">{schedule.entity_name}</div>
                          <div className="text-xs text-slate-500">
                            {schedule.params?.business_type} en {schedule.params?.city}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3" />
                            Última: {formatDate(schedule.last_run)}
                          </div>
                          <div className={`flex items-center gap-1 ${daysUntil && daysUntil < 0 ? 'text-yellow-500' : 'text-slate-500'}`}>
                            <Calendar className="w-3 h-3" />
                            {daysUntil !== null ? (
                              daysUntil < 0 ? `${Math.abs(daysUntil)}d atrasado` : `${daysUntil}d para próxima`
                            ) : 'Pendiente'}
                          </div>
                          {schedule.last_run_status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : schedule.last_run_status === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteSchedule(schedule.id)}
                          className="text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Searches Tab */}
        <TabsContent value="recent" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5 text-green-500" />
                Búsquedas Recientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentRuns.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No hay búsquedas recientes aún.</p>
                </div>
              ) : (
                recentRuns.map(run => (
                  <div key={run.id} className={`p-4 rounded-lg border ${
                    run.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : 
                    run.status === 'failed' ? 'border-red-500/30 bg-red-500/5' : 
                    'border-blue-500/30 bg-blue-500/5'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-white font-medium">
                          {run.params?.business_type || 'Unknown'} en {run.params?.city || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {run.results_count > 0 && (
                          <Badge className="bg-green-500/20 text-green-400">
                            {run.results_count} negocios
                          </Badge>
                        )}
                        <Badge className={`${
                          run.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                          run.status === 'failed' ? 'bg-red-500/20 text-red-400' : 
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {run.status === 'completed' ? 'Completado' : 
                           run.status === 'failed' ? 'Fallido' : 'En progreso'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mt-2">
                      {run.started_at && new Date(run.started_at).toLocaleString('es-MX')}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-green-500" />
                Negocios Encontrados ({results.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Building className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No se han encontrado negocios aún. ¡Inicia una búsqueda!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {results.slice(0, 50).map((business, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-[#222] rounded-lg bg-[#0a0a0a]">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{business.name}</div>
                        <div className="text-xs text-slate-500 truncate">{business.address}</div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        {business.rating && (
                          <div className="flex items-center gap-1 text-yellow-500 text-sm">
                            <Star className="w-3 h-3 fill-yellow-500" />
                            {business.rating}
                          </div>
                        )}
                        {business.phone && (
                          <a href={`tel:${business.phone}`} className="text-slate-400 hover:text-green-400">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {business.website && (
                          <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-green-400">
                            <Globe className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SmallBusinessFinder;
