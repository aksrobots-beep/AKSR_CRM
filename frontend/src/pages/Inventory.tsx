import { useEffect, useState } from 'react';
import { Header } from '../components/layout';
import { DataTable, StatsCard, type Column } from '../components/ui';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';
import type { InventoryItem } from '../types';
import { Package, AlertTriangle, TrendingDown, DollarSign, X, Minus, Plus, History, Edit, Trash2, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { validateNumber } from '../utils/validation';
import type { InventorySerialNumber } from '../types';

interface StockMovement {
  itemId: string;
  itemName: string;
  quantity: number;
  type: 'take' | 'add';
  reason: string;
  ticketNumber?: string;
  serialNumbers?: string[];
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
  const [formData, setFormData] = useState({ sku: '', name: '', description: '', category: 'spare_parts', quantity: 0, min_quantity: 0, unit_price: 0, currency: 'MYR', supplier: '', location: '', track_serial_numbers: false });
  const [takeData, setTakeData] = useState({ quantity: 1, reason: '', ticket_id: '' });
  const [addStockData, setAddStockData] = useState({ quantity: 1, reason: '' });
  const [formSNs, setFormSNs] = useState<string[]>([]);
  const [showSNModal, setShowSNModal] = useState(false);
  const [serialNumbers, setSerialNumbers] = useState<InventorySerialNumber[]>([]);
  const [newSNs, setNewSNs] = useState<string[]>(['']);
  const [snLoading, setSNLoading] = useState(false);
  const [takeSNSelection, setTakeSNSelection] = useState<Set<string>>(new Set());
  const [availableSNsForTake, setAvailableSNsForTake] = useState<InventorySerialNumber[]>([]);
  const [takeSNLoading, setTakeSNLoading] = useState(false);
  const [addStockSNs, setAddStockSNs] = useState<string[]>(['']);

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

  const openSNModal = async (item: InventoryItem) => {
    setSelectedItem(item);
    setSNLoading(true);
    setShowSNModal(true);
    try {
      const data = await api.getSerialNumbers(item.id);
      setSerialNumbers(data.map((sn: any) => ({
        id: sn.id,
        inventoryId: sn.inventory_id,
        serialNumber: sn.serial_number,
        status: sn.status || 'available',
        notes: sn.notes || '',
        createdAt: new Date(sn.created_at),
        createdBy: sn.created_by || '',
      })));
    } catch {
      setSerialNumbers([]);
    }
    setSNLoading(false);
    setNewSNs(['']);
  };

  const handleAddSerialNumbers = async () => {
    if (!selectedItem) return;
    const filtered = newSNs.filter(sn => sn.trim());
    if (filtered.length === 0) return;
    try {
      const result = await api.addSerialNumbers(selectedItem.id, filtered);
      if (result.duplicates?.length > 0) {
        alert(`Duplicate serial numbers skipped: ${result.duplicates.join(', ')}`);
      }
      await openSNModal(selectedItem);
    } catch (error: any) {
      alert(error.message || 'Failed to add serial numbers');
    }
  };

  const handleDeleteSN = async (snId: string) => {
    if (!selectedItem) return;
    if (!confirm('Delete this serial number?')) return;
    try {
      await api.deleteSerialNumber(selectedItem.id, snId);
      setSerialNumbers(prev => prev.filter(sn => sn.id !== snId));
    } catch (error: any) {
      alert(error.message || 'Failed to delete serial number');
    }
  };

  const handleUpdateSNStatus = async (snId: string, status: string) => {
    if (!selectedItem) return;
    try {
      await api.updateSerialNumber(selectedItem.id, snId, { status });
      setSerialNumbers(prev => prev.map(sn => sn.id === snId ? { ...sn, status: status as any } : sn));
    } catch (error: any) {
      alert(error.message || 'Failed to update serial number');
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
    
    // Validate serial numbers if tracking is on and quantity > 0
    if (formData.track_serial_numbers && formData.quantity > 0) {
      const filledSNs = formSNs.filter(sn => sn.trim());
      if (filledSNs.length < formData.quantity) {
        alert(`Please enter serial numbers for all ${formData.quantity} units. (${filledSNs.length} of ${formData.quantity} filled)`);
        return;
      }
    }

    try {
      if (selectedItem) {
        await updateInventoryItem(selectedItem.id, formData as any);
        // Add any new serial numbers for edited item
        if (formData.track_serial_numbers) {
          const filledSNs = formSNs.filter(sn => sn.trim());
          if (filledSNs.length > 0) {
            await api.addSerialNumbers(selectedItem.id, filledSNs);
          }
        }
        setSelectedItem(null);
      } else {
        const newItem = await addInventoryItem(formData as any);
        // Create serial numbers for the new item
        if (formData.track_serial_numbers) {
          const filledSNs = formSNs.filter(sn => sn.trim());
          if (filledSNs.length > 0 && newItem?.id) {
            await api.addSerialNumbers(newItem.id, filledSNs);
          }
        }
      }
      setShowAddModal(false);
      setSelectedItem(null);
      setFormData({ sku: '', name: '', description: '', category: 'spare_parts', quantity: 0, min_quantity: 0, unit_price: 0, currency: 'MYR', supplier: '', location: '', track_serial_numbers: false });
      setFormSNs([]);
    } catch (error) { console.error('Failed to add/update item:', error); }
  };

  const handleTakeParts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const isSNTracked = selectedItem.trackSerialNumbers;
    const qty = isSNTracked ? takeSNSelection.size : takeData.quantity;

    if (isSNTracked && qty === 0) {
      alert('Please select at least one serial number to take.');
      return;
    }

    if (!isSNTracked) {
      const qtyValidation = validateNumber(String(takeData.quantity), { 
        allowDecimal: false, min: 1, max: selectedItem.quantity, required: true 
      });
      if (!qtyValidation.valid) {
        alert('Quantity: ' + qtyValidation.error);
        return;
      }
    }
    
    try {
      const ticket = tickets.find(t => t.id === takeData.ticket_id);
      const selectedSNLabels = isSNTracked
        ? availableSNsForTake.filter(sn => takeSNSelection.has(sn.id)).map(sn => sn.serialNumber)
        : [];
      const reason = takeData.ticket_id 
        ? `Taken for ticket ${ticket?.ticketNumber || takeData.ticket_id}: ${takeData.reason}`
        : takeData.reason || 'Parts taken from office';
      
      const snIds = isSNTracked ? Array.from(takeSNSelection) : undefined;
      await adjustStock(selectedItem.id, -qty, reason, snIds);
      
      saveMovement({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: qty,
        type: 'take',
        reason: reason,
        ticketNumber: ticket?.ticketNumber,
        serialNumbers: selectedSNLabels.length > 0 ? selectedSNLabels : undefined,
        timestamp: new Date(),
      });
      
      setShowTakeModal(false);
      setSelectedItem(null);
      setTakeData({ quantity: 1, reason: '', ticket_id: '' });
      setTakeSNSelection(new Set());
    } catch (error: any) {
      alert(error.message || 'Failed to take parts');
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const isSNTracked = selectedItem.trackSerialNumbers;
    const filteredSNs = isSNTracked ? addStockSNs.filter(sn => sn.trim()) : [];
    const qty = isSNTracked ? filteredSNs.length : addStockData.quantity;

    if (isSNTracked && qty === 0) {
      alert('Please enter at least one serial number.');
      return;
    }

    if (!isSNTracked) {
      const qtyValidation = validateNumber(String(addStockData.quantity), { 
        allowDecimal: false, min: 1, required: true 
      });
      if (!qtyValidation.valid) {
        alert('Quantity: ' + qtyValidation.error);
        return;
      }
    }
    
    try {
      const reason = addStockData.reason || 'Stock replenishment';

      // If SN tracked, create the serial numbers first, then adjust stock
      let createdSnIds: string[] | undefined;
      if (isSNTracked && filteredSNs.length > 0) {
        const result = await api.addSerialNumbers(selectedItem.id, filteredSNs);
        if (result.duplicates?.length > 0) {
          alert(`Duplicate serial numbers skipped: ${result.duplicates.join(', ')}`);
        }
        createdSnIds = result.created?.map((sn: any) => sn.id) || [];
        if (createdSnIds!.length === 0) {
          alert('No new serial numbers were added (all duplicates).');
          return;
        }
      }

      const adjustQty = isSNTracked ? (createdSnIds?.length || 0) : addStockData.quantity;
      await adjustStock(selectedItem.id, adjustQty, reason, createdSnIds);
      
      saveMovement({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: adjustQty,
        type: 'add',
        reason: reason,
        serialNumbers: isSNTracked ? filteredSNs : undefined,
        timestamp: new Date(),
      });
      
      setShowAddStockModal(false);
      setSelectedItem(null);
      setAddStockData({ quantity: 1, reason: '' });
      setAddStockSNs(['']);
    } catch (error: any) {
      alert(error.message || 'Failed to add stock');
    }
  };

  const openTakeModal = async (item: InventoryItem) => {
    setSelectedItem(item);
    setTakeData({ quantity: 1, reason: '', ticket_id: '' });
    setTakeSNSelection(new Set());
    setShowTakeModal(true);
    if (item.trackSerialNumbers) {
      setTakeSNLoading(true);
      try {
        const data = await api.getSerialNumbers(item.id);
        const mapped = data.map((sn: any) => ({
          id: sn.id,
          inventoryId: sn.inventory_id,
          serialNumber: sn.serial_number,
          status: sn.status || 'available',
          notes: sn.notes || '',
          createdAt: new Date(sn.created_at),
          createdBy: sn.created_by || '',
        }));
        setAvailableSNsForTake(mapped.filter((sn: InventorySerialNumber) => sn.status === 'available'));
      } catch {
        setAvailableSNsForTake([]);
      }
      setTakeSNLoading(false);
    }
  };

  const openAddStockModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setAddStockData({ quantity: 1, reason: '' });
    setAddStockSNs(['']);
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
      currency: item.currency || 'MYR',
      supplier: item.supplier || '',
      location: item.location,
      track_serial_numbers: item.trackSerialNumbers,
    });
    setFormSNs([]);
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
    { key: 'trackSerialNumbers', header: 'SN', render: (item) => item.trackSerialNumbers ? (
      <button onClick={(e) => { e.stopPropagation(); openSNModal(item); }} className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded hover:bg-primary-100 transition-colors flex items-center gap-1" title="Manage Serial Numbers">
        <Hash className="w-3 h-3" />SN
      </button>
    ) : <span className="text-neutral-300">-</span> },
    { key: 'unitPrice', header: 'Unit Price', sortable: true, render: (item) => {
      const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice) || 0;
      const sym = item.currency === 'USD' ? 'USD' : item.currency === 'SGD' ? 'SGD' : item.currency === 'CNY' ? 'CNY' : 'RM';
      return `${sym} ${price.toFixed(2)}`;
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
      <Header title="Inventory" subtitle={`${inventory.length} items in stock`} showAddButton addButtonText="Add Item" onAddClick={() => { setSelectedItem(null); setFormData({ sku: '', name: '', description: '', category: 'spare_parts', quantity: 0, min_quantity: 0, unit_price: 0, currency: 'MYR', supplier: '', location: '', track_serial_numbers: false }); setFormSNs([]); setShowAddModal(true); }} />
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
                      {movement.serialNumbers && movement.serialNumbers.length > 0 && (
                        <p className="text-xs text-primary-600 font-mono mt-0.5">SN: {movement.serialNumbers.join(', ')}</p>
                      )}
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
              <div className="grid grid-cols-3 gap-4"><div><label className="label">Category</label><select className="input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}><option value="spare_parts">Spare Parts</option><option value="consumables">Consumables</option><option value="tools">Tools</option><option value="components">Components</option></select></div><div><label className="label">Quantity</label><input type="number" className="input" value={formData.quantity} onChange={(e) => {
                const newQty = parseInt(e.target.value) || 0;
                setFormData({ ...formData, quantity: newQty });
                if (formData.track_serial_numbers) {
                  setFormSNs(prev => {
                    const arr = [...prev];
                    while (arr.length < newQty) arr.push('');
                    return arr.slice(0, newQty);
                  });
                }
              }} /></div><div><label className="label">Min Qty</label><input type="number" className="input" value={formData.min_quantity} onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })} /></div></div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Unit Price</label>
                  <div className="flex gap-1">
                    <select className="input w-20 flex-shrink-0 px-1.5 text-sm" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })}>
                      <option value="MYR">RM</option>
                      <option value="USD">USD</option>
                      <option value="SGD">SGD</option>
                      <option value="CNY">CNY</option>
                    </select>
                    <input type="number" step="0.01" className="input flex-1" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} />
                  </div>
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
              <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={formData.track_serial_numbers} onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData({ ...formData, track_serial_numbers: checked });
                    if (checked && formData.quantity > 0) {
                      setFormSNs(prev => {
                        const arr = [...prev];
                        while (arr.length < formData.quantity) arr.push('');
                        return arr.slice(0, formData.quantity);
                      });
                    } else if (!checked) {
                      setFormSNs([]);
                    }
                  }} className="sr-only peer" />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
                <div>
                  <p className="font-medium text-sm text-neutral-900">Track Serial Numbers</p>
                  <p className="text-xs text-neutral-500">Enable to track individual serial numbers for each unit</p>
                </div>
              </div>

              {/* Serial number inputs when tracking is enabled */}
              {formData.track_serial_numbers && formSNs.length > 0 && (
                <div className="space-y-2 border rounded-lg p-4 bg-neutral-50/50">
                  <div className="flex items-center justify-between">
                    <label className="label mb-0">Serial Numbers ({formSNs.filter(s => s.trim()).length}/{formSNs.length})</label>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {formSNs.map((sn, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400 w-6 text-right font-mono">{idx + 1}.</span>
                        <input
                          type="text"
                          className="input flex-1"
                          value={sn}
                          onChange={(e) => {
                            const updated = [...formSNs];
                            updated[idx] = e.target.value;
                            setFormSNs(updated);
                          }}
                          placeholder={`Serial number #${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => {
                    setFormSNs([...formSNs, '']);
                    setFormData({ ...formData, quantity: formData.quantity + 1 });
                  }} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    + Add Another Serial Number
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" className="btn-primary flex-1">{selectedItem ? 'Update Item' : 'Add Item'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Take Parts Modal */}
      {showTakeModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`card w-full ${selectedItem.trackSerialNumbers ? 'max-w-xl' : 'max-w-md'} animate-scale-in max-h-[90vh] flex flex-col`}>
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Take Parts</h2>
                <p className="text-sm text-neutral-500 mt-1">From: {selectedItem.name} ({selectedItem.sku})</p>
              </div>
              <button onClick={() => { setShowTakeModal(false); setSelectedItem(null); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleTakeParts} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-500">Current Stock</span>
                  <span className={`font-bold text-lg ${selectedItem.quantity <= selectedItem.minQuantity ? 'text-danger-600' : 'text-neutral-900'}`}>
                    {selectedItem.quantity} units
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Unit Price</span>
                  <span className="font-medium">{selectedItem.currency === 'USD' ? 'USD' : selectedItem.currency === 'SGD' ? 'SGD' : selectedItem.currency === 'CNY' ? 'CNY' : 'RM'} {(typeof selectedItem.unitPrice === 'number' ? selectedItem.unitPrice : parseFloat(selectedItem.unitPrice) || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Serial Number selection for SN-tracked items */}
              {selectedItem.trackSerialNumbers ? (
                <div className="space-y-2">
                  <label className="label">Select Serial Numbers to Take *</label>
                  {takeSNLoading ? (
                    <p className="text-sm text-neutral-500 p-3">Loading serial numbers...</p>
                  ) : availableSNsForTake.length === 0 ? (
                    <div className="p-4 bg-neutral-50 rounded-lg text-center space-y-3">
                      <p className="text-sm text-neutral-500">No available serial numbers found.</p>
                      <button
                        type="button"
                        onClick={() => { setShowTakeModal(false); openSNModal(selectedItem); }}
                        className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-2"
                      >
                        <Hash className="w-4 h-4" />
                        Add Serial Numbers Now
                      </button>
                    </div>
                  ) : (
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      <div className="p-2 bg-neutral-50 border-b flex items-center justify-between">
                        <span className="text-xs font-medium text-neutral-600">{availableSNsForTake.length} available</span>
                        <span className="text-xs font-semibold text-primary-600">{takeSNSelection.size} selected</span>
                      </div>
                      {availableSNsForTake.map((sn) => (
                        <label key={sn.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-primary-50 cursor-pointer border-b last:border-b-0 transition-colors">
                          <input
                            type="checkbox"
                            checked={takeSNSelection.has(sn.id)}
                            onChange={() => {
                              setTakeSNSelection(prev => {
                                const next = new Set(prev);
                                if (next.has(sn.id)) next.delete(sn.id);
                                else next.add(sn.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="font-mono text-sm flex-1">{sn.serialNumber}</span>
                          <span className="text-xs bg-success-100 text-success-700 px-2 py-0.5 rounded-full">Available</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {takeSNSelection.size > 0 && (
                    <p className="text-xs text-neutral-500">
                      Value: {selectedItem.currency === 'USD' ? 'USD' : selectedItem.currency === 'SGD' ? 'SGD' : selectedItem.currency === 'CNY' ? 'CNY' : 'RM'} {(takeSNSelection.size * (typeof selectedItem.unitPrice === 'number' ? selectedItem.unitPrice : parseFloat(selectedItem.unitPrice) || 0)).toFixed(2)}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="label">Quantity to Take *</label>
                  <input type="number" className="input" min="1" max={selectedItem.quantity} required
                    value={takeData.quantity}
                    onChange={(e) => setTakeData({ ...takeData, quantity: Math.min(parseInt(e.target.value) || 1, selectedItem.quantity) })}
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Value: {selectedItem.currency === 'USD' ? 'USD' : selectedItem.currency === 'SGD' ? 'SGD' : selectedItem.currency === 'CNY' ? 'CNY' : 'RM'} {(takeData.quantity * (typeof selectedItem.unitPrice === 'number' ? selectedItem.unitPrice : parseFloat(selectedItem.unitPrice) || 0)).toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <label className="label">Link to Service Ticket (Optional)</label>
                <select className="input" value={takeData.ticket_id} onChange={(e) => setTakeData({ ...takeData, ticket_id: e.target.value })}>
                  <option value="">No ticket</option>
                  {openTickets.map(t => (
                    <option key={t.id} value={t.id}>{t.ticketNumber} - {t.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Reason / Notes</label>
                <textarea className="input min-h-[80px]" value={takeData.reason} onChange={(e) => setTakeData({ ...takeData, reason: e.target.value })}
                  placeholder="e.g., Replacement for faulty motor, routine maintenance..."
                />
              </div>

              {(() => {
                const qty = selectedItem.trackSerialNumbers ? takeSNSelection.size : takeData.quantity;
                return qty > 0 && selectedItem.quantity - qty <= selectedItem.minQuantity ? (
                  <div className="flex items-center gap-2 p-3 bg-warning-50 border border-warning-200 rounded-lg text-warning-700 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>This will put the item below minimum stock level!</span>
                  </div>
                ) : null;
              })()}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowTakeModal(false); setSelectedItem(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1"
                  disabled={selectedItem.trackSerialNumbers && takeSNSelection.size === 0}
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Take {selectedItem.trackSerialNumbers ? takeSNSelection.size : takeData.quantity} Part{(selectedItem.trackSerialNumbers ? takeSNSelection.size : takeData.quantity) !== 1 ? 's' : ''}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Serial Numbers Modal */}
      {showSNModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl animate-scale-in max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Serial Numbers</h2>
                <p className="text-sm text-neutral-500 mt-1">{selectedItem.name} ({selectedItem.sku})</p>
              </div>
              <button onClick={() => { setShowSNModal(false); setSelectedItem(null); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Add new serial numbers */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-neutral-700">Add Serial Numbers</h3>
                {newSNs.map((sn, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      value={sn}
                      onChange={(e) => {
                        const updated = [...newSNs];
                        updated[idx] = e.target.value;
                        setNewSNs(updated);
                      }}
                      placeholder={`Serial number #${idx + 1}`}
                    />
                    {newSNs.length > 1 && (
                      <button onClick={() => setNewSNs(newSNs.filter((_, i) => i !== idx))} className="p-2 bg-danger-100 text-danger-600 rounded-lg hover:bg-danger-200">
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNewSNs([...newSNs, ''])} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    + Add Another
                  </button>
                  <button type="button" onClick={handleAddSerialNumbers} className="btn-primary text-sm px-4 py-1.5 ml-auto" disabled={newSNs.every(sn => !sn.trim())}>
                    Save Serial Numbers
                  </button>
                </div>
              </div>

              {/* Existing serial numbers list */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-neutral-700">
                  Existing Serial Numbers ({serialNumbers.length})
                </h3>
                {snLoading ? (
                  <p className="text-sm text-neutral-500">Loading...</p>
                ) : serialNumbers.length === 0 ? (
                  <p className="text-sm text-neutral-400">No serial numbers added yet.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-neutral-600">#</th>
                          <th className="text-left px-3 py-2 font-medium text-neutral-600">Serial Number</th>
                          <th className="text-left px-3 py-2 font-medium text-neutral-600">Status</th>
                          <th className="text-right px-3 py-2 font-medium text-neutral-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {serialNumbers.map((sn, idx) => (
                          <tr key={sn.id} className="hover:bg-neutral-50">
                            <td className="px-3 py-2 text-neutral-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono">{sn.serialNumber}</td>
                            <td className="px-3 py-2">
                              <select
                                value={sn.status}
                                onChange={(e) => handleUpdateSNStatus(sn.id, e.target.value)}
                                className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${
                                  sn.status === 'available' ? 'bg-success-100 text-success-700' :
                                  sn.status === 'in_use' ? 'bg-primary-100 text-primary-700' :
                                  sn.status === 'defective' ? 'bg-danger-100 text-danger-700' :
                                  'bg-neutral-100 text-neutral-600'
                                }`}
                              >
                                <option value="available">Available</option>
                                <option value="in_use">In Use</option>
                                <option value="defective">Defective</option>
                                <option value="retired">Retired</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => handleDeleteSN(sn.id)} className="p-1 bg-danger-100 text-danger-600 rounded hover:bg-danger-200" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`card w-full ${selectedItem.trackSerialNumbers ? 'max-w-xl' : 'max-w-md'} animate-scale-in max-h-[90vh] flex flex-col`}>
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Add Stock</h2>
                <p className="text-sm text-neutral-500 mt-1">To: {selectedItem.name} ({selectedItem.sku})</p>
              </div>
              <button onClick={() => { setShowAddStockModal(false); setSelectedItem(null); }} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddStock} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-500">Current Stock</span>
                  <span className="font-bold text-lg">{selectedItem.quantity} units</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">After Adding</span>
                  <span className="font-bold text-lg text-success-600">
                    {selectedItem.quantity + (selectedItem.trackSerialNumbers ? addStockSNs.filter(s => s.trim()).length : addStockData.quantity)} units
                  </span>
                </div>
              </div>

              {/* Serial Number entry for SN-tracked items */}
              {selectedItem.trackSerialNumbers ? (
                <div className="space-y-2">
                  <label className="label">Enter Serial Numbers for New Stock *</label>
                  <p className="text-xs text-neutral-500">Each serial number represents one unit being added to stock.</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {addStockSNs.map((sn, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400 w-6 text-right">{idx + 1}.</span>
                        <input
                          type="text"
                          className="input flex-1"
                          value={sn}
                          onChange={(e) => {
                            const updated = [...addStockSNs];
                            updated[idx] = e.target.value;
                            setAddStockSNs(updated);
                          }}
                          placeholder={`Serial number #${idx + 1}`}
                        />
                        {addStockSNs.length > 1 && (
                          <button type="button" onClick={() => setAddStockSNs(addStockSNs.filter((_, i) => i !== idx))}
                            className="p-1.5 bg-danger-100 text-danger-600 rounded-lg hover:bg-danger-200">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAddStockSNs([...addStockSNs, ''])}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    + Add Another Serial Number
                  </button>
                </div>
              ) : (
                <div>
                  <label className="label">Quantity to Add *</label>
                  <input type="number" className="input" min="1" required
                    value={addStockData.quantity}
                    onChange={(e) => setAddStockData({ ...addStockData, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}

              <div>
                <label className="label">Reason / Notes</label>
                <textarea className="input min-h-[80px]" value={addStockData.reason}
                  onChange={(e) => setAddStockData({ ...addStockData, reason: e.target.value })}
                  placeholder="e.g., New stock received from supplier, inventory adjustment..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowAddStockModal(false); setSelectedItem(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1 bg-success-600 hover:bg-success-700"
                  disabled={selectedItem.trackSerialNumbers && addStockSNs.every(sn => !sn.trim())}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add {selectedItem.trackSerialNumbers ? addStockSNs.filter(s => s.trim()).length : addStockData.quantity} to Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
