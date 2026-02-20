import { useEffect, useState } from 'react';
import { Header } from '../components/layout';
import { DataTable, StatsCard, type Column } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';
import type { InventoryItem } from '../types';
import { Package, AlertTriangle, TrendingDown, DollarSign, X, Minus, Plus, History, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { validateNumber } from '../utils/validation';

interface StockMovement {
  itemId: string;
  itemName: string;
  quantity: number;
  type: 'take' | 'add';
  reason: string;
  ticketNumber?: string;
  timestamp: Date;
}

export function Inventory() {
  const { inventory, tickets, fetchInventory, fetchTickets, addInventoryItem, updateInventoryItem, adjustStock, deleteInventoryItem, toggleInventoryActive } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTakeModal, setShowTakeModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({ sku: '', name: '', description: '', category: 'spare_parts', quantity: 0, min_quantity: 0, unit_price: 0, supplier: '', location: '' });
  const [takeData, setTakeData] = useState({ quantity: 1, reason: '', ticket_id: '' });
  const [addStockData, setAddStockData] = useState({ quantity: 1, reason: '' });

  useEffect(() => { 
    fetchInventory(); 
    fetchTickets();
    fetchSuppliers();
    // Load stock movements from localStorage
    const saved = localStorage.getItem('ak-crm-stock-movements');
    if (saved) {
      try {
        setStockMovements(JSON.parse(saved));
      } catch {
        setStockMovements([]);
      }
    }
  }, []);

  const fetchSuppliers = async () => {
    try {
      const data = await api.getSuppliers();
      const transformed = data.map((s: any) => ({
        id: s.id,
        name: s.name,
      }));
      setSuppliers(transformed);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const saveMovement = (movement: StockMovement) => {
    const updated = [movement, ...stockMovements].slice(0, 50); // Keep last 50 movements
    setStockMovements(updated);
    localStorage.setItem('ak-crm-stock-movements', JSON.stringify(updated));
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate quantity
    const qtyValidation = validateNumber(String(formData.quantity), { 
      allowDecimal: false, 
      min: 0, 
      required: true 
    });
    if (!qtyValidation.valid) {
      alert('Quantity: ' + qtyValidation.error);
      return;
    }
    
    // Validate min_quantity
    const minQtyValidation = validateNumber(String(formData.min_quantity), { 
      allowDecimal: false, 
      min: 0, 
      required: true 
    });
    if (!minQtyValidation.valid) {
      alert('Minimum Quantity: ' + minQtyValidation.error);
      return;
    }
    
    // Validate unit_price
    const priceValidation = validateNumber(String(formData.unit_price), { 
      allowDecimal: true, 
      min: 0, 
      required: true 
    });
    if (!priceValidation.valid) {
      alert('Unit Price: ' + priceValidation.error);
      return;
    }
    
    try {
      if (selectedItem) {
        // Editing existing item
        await updateInventoryItem(selectedItem.id, formData as any);
        setSelectedItem(null);
      } else {
        // Adding new item
        await addInventoryItem(formData as any);
      }
      setShowAddModal(false);
      setSelectedItem(null);
      setFormData({ sku: '', name: '', description: '', category: 'spare_parts', quantity: 0, min_quantity: 0, unit_price: 0, supplier: '', location: '' });
    } catch (error) { console.error('Failed to add/update item:', error); }
  };

  const handleTakeParts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    // Validate quantity
    const qtyValidation = validateNumber(String(takeData.quantity), { 
      allowDecimal: false, 
      min: 1,
      max: selectedItem.quantity,
      required: true 
    });
    if (!qtyValidation.valid) {
      alert('Quantity: ' + qtyValidation.error);
      return;
    }
    
    try {
      const ticket = tickets.find(t => t.id === takeData.ticket_id);
      const reason = takeData.ticket_id 
        ? `Taken for ticket ${ticket?.ticketNumber || takeData.ticket_id}: ${takeData.reason}`
        : takeData.reason || 'Parts taken from office';
      
      await adjustStock(selectedItem.id, -takeData.quantity, reason);
      
      // Save movement record
      saveMovement({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: takeData.quantity,
        type: 'take',
        reason: reason,
        ticketNumber: ticket?.ticketNumber,
        timestamp: new Date(),
      });
      
      setShowTakeModal(false);
      setSelectedItem(null);
      setTakeData({ quantity: 1, reason: '', ticket_id: '' });
    } catch (error: any) {
      alert(error.message || 'Failed to take parts');
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    // Validate quantity
    const qtyValidation = validateNumber(String(addStockData.quantity), { 
      allowDecimal: false, 
      min: 1,
      required: true 
    });
    if (!qtyValidation.valid) {
      alert('Quantity: ' + qtyValidation.error);
      return;
    }
    
    try {
      const reason = addStockData.reason || 'Stock replenishment';
      await adjustStock(selectedItem.id, addStockData.quantity, reason);
      
      // Save movement record
      saveMovement({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: addStockData.quantity,
        type: 'add',
        reason: reason,
        timestamp: new Date(),
      });
      
      setShowAddStockModal(false);
      setSelectedItem(null);
      setAddStockData({ quantity: 1, reason: '' });
    } catch (error: any) {
      alert(error.message || 'Failed to add stock');
    }
  };

  const openTakeModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setTakeData({ quantity: 1, reason: '', ticket_id: '' });
    setShowTakeModal(true);
  };

  const openAddStockModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setAddStockData({ quantity: 1, reason: '' });
    setShowAddStockModal(true);
  };

  const handleToggleActive = async (item: InventoryItem, isActive: boolean) => {
    try {
      await toggleInventoryActive(item.id, isActive);
      await fetchInventory();
    } catch (error) {
      console.error('Failed to toggle inventory status:', error);
    }
  };

  const handleDeleteFromTable = async (item: InventoryItem) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
    try {
      await deleteInventoryItem(item.id);
      await fetchInventory();
    } catch (error) {
      console.error('Failed to delete inventory item:', error);
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormData({
      sku: item.sku,
      name: item.name,
      description: item.description || '',
      category: item.category,
      quantity: item.quantity,
      min_quantity: item.minQuantity,
      unit_price: item.unitPrice,
      supplier: item.supplier || '',
      location: item.location,
    });
    setShowAddModal(true);
  };

  const lowStockItems = inventory.filter((i) => i.quantity <= i.minQuantity);
  const totalValue = inventory.reduce((sum, i) => {
    const price = typeof i.unitPrice === 'number' ? i.unitPrice : parseFloat(i.unitPrice) || 0;
    const qty = typeof i.quantity === 'number' ? i.quantity : parseInt(i.quantity) || 0;
    return sum + (qty * price);
  }, 0);
  const openTickets = tickets.filter(t => !['resolved', 'closed'].includes(t.status));

  const tableColumns: Column<InventoryItem>[] = [
    { key: 'sku', header: 'SKU', sortable: true, render: (item) => <span className="font-mono text-sm">{item.sku}</span> },
    { key: 'name', header: 'Item', sortable: true, render: (item) => <div><p className="font-medium text-neutral-900">{item.name}</p>{item.description && <p className="text-xs text-neutral-500 truncate max-w-xs">{item.description}</p>}</div> },
    { key: 'category', header: 'Category', sortable: true, render: (item) => <span className="badge-neutral capitalize">{item.category.replace('_', ' ')}</span> },
    { key: 'quantity', header: 'Stock', sortable: true, render: (item) => { 
      const isLow = item.quantity <= item.minQuantity; 
      return (
        <div className={`flex items-center gap-2 ${isLow ? 'low-stock-flash' : ''}`}>
          <span className={`font-semibold ${isLow ? 'text-danger-600' : 'text-neutral-900'}`}>{item.quantity}</span>
          {isLow && <AlertTriangle className="w-4 h-4 text-danger-500 animate-pulse" />}
          <span className="text-xs text-neutral-400">/ min {item.minQuantity}</span>
        </div>
      );
    } },
    { key: 'unitPrice', header: 'Unit Price', sortable: true, render: (item) => {
      const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice) || 0;
      return `RM ${price.toFixed(2)}`;
    } },
    { key: 'location', header: 'Location' },
    {
      key: 'isActive',
      header: 'Active',
      render: (item) => (
        <div onClick={(e) => e.stopPropagation()}>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={item.isActive}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleActive(item, e as any);
              }}
              onClick={(e) => e.stopPropagation()}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success-500"></div>
          </label>
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: (item) => (
        <div className="text-sm">
          <div className="text-neutral-900">{format(new Date(item.updatedAt), 'MMM d, yyyy')}</div>
          <div className="text-xs text-neutral-500">{format(new Date(item.updatedAt), 'h:mm a')}</div>
        </div>
      ),
    },
    { 
      key: 'actions', 
      header: 'Actions', 
      render: (item) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
            className="p-1.5 bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-200 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); openTakeModal(item); }}
            className="p-1.5 bg-warning-100 text-warning-600 rounded-lg hover:bg-warning-200 transition-colors"
            title="Take Parts"
            disabled={item.quantity === 0}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); openAddStockModal(item); }}
            className="p-1.5 bg-success-100 text-success-600 rounded-lg hover:bg-success-200 transition-colors"
            title="Add Stock"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteFromTable(item);
            }}
            className="p-1.5 bg-danger-100 text-danger-600 rounded-lg hover:bg-danger-200 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Inventory" subtitle={`${inventory.length} items in stock`} showAddButton addButtonText="Add Item" onAddClick={() => setShowAddModal(true)} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard title="Total Items" value={inventory.length} icon={<Package className="w-5 h-5" />} color="primary" />
          <StatsCard title="Low Stock Alerts" value={lowStockItems.length} icon={<TrendingDown className="w-5 h-5" />} color={lowStockItems.length > 0 ? 'danger' : 'success'} />
          <StatsCard title="Total Stock Value" value={`RM ${totalValue.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} color="success" />
          <StatsCard title="Categories" value={new Set(inventory.map((i) => i.category)).size} icon={<Package className="w-5 h-5" />} color="accent" />
        </div>

        {lowStockItems.length > 0 && (
          <div className="card p-4 border-warning-200 bg-warning-50">
            <div className="flex items-center gap-3 mb-3"><AlertTriangle className="w-5 h-5 text-warning-600" /><h3 className="font-semibold text-warning-800">Low Stock Alert</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {lowStockItems.map((item) => <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded-lg"><div><p className="font-medium text-sm text-neutral-900">{item.name}</p><p className="text-xs text-neutral-500">{item.sku}</p></div><span className="text-danger-600 font-semibold">{item.quantity} left</span></div>)}
            </div>
          </div>
        )}

        {/* Recent Stock Movements */}
        {stockMovements.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <History className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-neutral-900">Recent Stock Movements</h3>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stockMovements.slice(0, 10).map((movement, index) => (
                <div key={index} className={`flex items-center justify-between p-2 rounded-lg ${movement.type === 'take' ? 'bg-warning-50' : 'bg-success-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${movement.type === 'take' ? 'bg-warning-100 text-warning-600' : 'bg-success-100 text-success-600'}`}>
                      {movement.type === 'take' ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{movement.itemName}</p>
                      <p className="text-xs text-neutral-500">{movement.reason}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${movement.type === 'take' ? 'text-warning-600' : 'text-success-600'}`}>
                      {movement.type === 'take' ? '-' : '+'}{movement.quantity}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {new Date(movement.timestamp).toLocaleString('en-MY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DataTable 
          columns={tableColumns} 
          data={inventory}
          getRowClassName={(item) => {
            const isLow = item.quantity <= item.minQuantity;
            return isLow ? 'low-stock-row-flash' : '';
          }}
        />
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between"><h2 className="text-xl font-semibold">{selectedItem ? 'Edit Inventory Item' : 'Add Inventory Item'}</h2><button onClick={() => { setShowAddModal(false); setSelectedItem(null); }} className="p-2 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4"><div><label className="label">SKU *</label><input type="text" className="input" required value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} /></div><div><label className="label">Name *</label><input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div></div>
              <div><label className="label">Description</label><textarea className="input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-4"><div><label className="label">Category</label><select className="input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}><option value="spare_parts">Spare Parts</option><option value="consumables">Consumables</option><option value="tools">Tools</option><option value="components">Components</option></select></div><div><label className="label">Quantity</label><input type="number" className="input" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} /></div><div><label className="label">Min Qty</label><input type="number" className="input" value={formData.min_quantity} onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })} /></div></div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Unit Price (RM)</label>
                  <input type="number" step="0.01" className="input" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Supplier</label>
                  <select 
                    className="input" 
                    value={formData.supplier} 
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Location</label>
                  <input type="text" className="input" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" className="btn-primary flex-1">Add Item</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Take Parts Modal */}
      {showTakeModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Take Parts</h2>
                <p className="text-sm text-neutral-500 mt-1">From: {selectedItem.name}</p>
              </div>
              <button onClick={() => { setShowTakeModal(false); setSelectedItem(null); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleTakeParts} className="p-6 space-y-4">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-500">Current Stock</span>
                  <span className={`font-bold text-lg ${selectedItem.quantity <= selectedItem.minQuantity ? 'text-danger-600' : 'text-neutral-900'}`}>
                    {selectedItem.quantity} units
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Unit Price</span>
                  <span className="font-medium">RM {selectedItem.unitPrice.toFixed(2)}</span>
                </div>
              </div>
              
              <div>
                <label className="label">Quantity to Take *</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max={selectedItem.quantity}
                  required
                  value={takeData.quantity}
                  onChange={(e) => setTakeData({ ...takeData, quantity: Math.min(parseInt(e.target.value) || 1, selectedItem.quantity) })}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Value: RM {((takeData.quantity * (typeof selectedItem.unitPrice === 'number' ? selectedItem.unitPrice : parseFloat(selectedItem.unitPrice) || 0))).toFixed(2)}
                </p>
              </div>

              <div>
                <label className="label">Link to Service Ticket (Optional)</label>
                <select
                  className="input"
                  value={takeData.ticket_id}
                  onChange={(e) => setTakeData({ ...takeData, ticket_id: e.target.value })}
                >
                  <option value="">No ticket</option>
                  {openTickets.map(t => (
                    <option key={t.id} value={t.id}>{t.ticketNumber} - {t.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Reason / Notes</label>
                <textarea
                  className="input min-h-[80px]"
                  value={takeData.reason}
                  onChange={(e) => setTakeData({ ...takeData, reason: e.target.value })}
                  placeholder="e.g., Replacement for faulty motor, routine maintenance..."
                />
              </div>

              {selectedItem.quantity - takeData.quantity <= selectedItem.minQuantity && (
                <div className="flex items-center gap-2 p-3 bg-warning-50 border border-warning-200 rounded-lg text-warning-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>This will put the item below minimum stock level!</span>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowTakeModal(false); setSelectedItem(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">
                  <Minus className="w-4 h-4 mr-2" />
                  Take {takeData.quantity} Part{takeData.quantity > 1 ? 's' : ''}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Add Stock</h2>
                <p className="text-sm text-neutral-500 mt-1">To: {selectedItem.name}</p>
              </div>
              <button onClick={() => { setShowAddStockModal(false); setSelectedItem(null); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddStock} className="p-6 space-y-4">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-500">Current Stock</span>
                  <span className="font-bold text-lg">{selectedItem.quantity} units</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">After Adding</span>
                  <span className="font-bold text-lg text-success-600">{selectedItem.quantity + addStockData.quantity} units</span>
                </div>
              </div>
              
              <div>
                <label className="label">Quantity to Add *</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  required
                  value={addStockData.quantity}
                  onChange={(e) => setAddStockData({ ...addStockData, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div>
                <label className="label">Reason / Notes</label>
                <textarea
                  className="input min-h-[80px]"
                  value={addStockData.reason}
                  onChange={(e) => setAddStockData({ ...addStockData, reason: e.target.value })}
                  placeholder="e.g., New stock received from supplier, inventory adjustment..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowAddStockModal(false); setSelectedItem(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1 bg-success-600 hover:bg-success-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add {addStockData.quantity} to Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
