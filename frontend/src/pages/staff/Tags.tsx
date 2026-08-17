import { useState } from 'react';
import {
  Search,
  Edit2,
  Trash2,
  Plus,
  Sparkles,
  Tag as TagIcon,
  Save,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import {
  useGetTagsQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  type Tag
} from '@/features/tags/tagsApi';
import { toast } from 'sonner';

const TAG_COLORS = [
  '#00201d', '#005c55', '#7f4025', '#DC2626',
  '#F59E0B', '#16A34A', '#6e7977', '#006f64', '#4fdbc8'
];

const COLOR_CLASSES: Record<string, string> = {
  '#00201d': 'bg-[#00201d]',
  '#005c55': 'bg-[#005c55]',
  '#7f4025': 'bg-[#7f4025]',
  '#DC2626': 'bg-[#DC2626]',
  '#F59E0B': 'bg-[#F59E0B]',
  '#16A34A': 'bg-[#16A34A]',
  '#6e7977': 'bg-[#6e7977]',
  '#006f64': 'bg-[#006f64]',
  '#4fdbc8': 'bg-[#4fdbc8]',
};

export function Tags() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeColor, setActiveColor] = useState<string>('#005c55');
  const [isAutoAssign, setIsAutoAssign] = useState(false);

  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: tags, isLoading } = useGetTagsQuery();
  const [createTag, { isLoading: isCreating }] = useCreateTagMutation();
  const [updateTag, { isLoading: isUpdating }] = useUpdateTagMutation();
  const [deleteTag] = useDeleteTagMutation();

  const filteredTags = (tags ?? []).filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async () => {
    const name = editingTag ? editingTag.name : newTagName;
    if (!name.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      if (editingTag) {
        await updateTag({
          id: editingTag.id,
          name: editingTag.name,
          color: activeColor,
        }).unwrap();
        toast.success('Tag updated');
      } else {
        await createTag({
          name: newTagName.trim(),
          color: activeColor,
        }).unwrap();
        toast.success('Tag created');
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to save tag');
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (!confirm(`Delete tag "${tag.name}"?`)) return;
    try {
      await deleteTag(tag.id).unwrap();
      toast.success('Tag deleted');
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to delete tag');
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setActiveColor(tag.color || '#005c55');
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingTag(null);
    setNewTagName('');
    setActiveColor('#005c55');
    setIsAutoAssign(false);
    setShowForm(false);
  };

  const isSaving = isCreating || isUpdating;

  return (
    <div className="min-h-screen bg-[#f7f9fb] font-body-base text-[#191c1e] flex flex-col lg:h-screen lg:overflow-hidden antialiased">
      <div className="flex-1 w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-0 lg:gap-8 lg:p-8 overflow-hidden">

        {/* LEFT COLUMN: EXISTING TAGS */}
        <div className="flex-1 flex flex-col px-4 pt-6 lg:px-0 lg:pt-0 overflow-hidden shrink-0 lg:min-w-[600px]">
          <header className="mb-6 lg:mb-8 shrink-0">
            <h1 className="text-[24px] lg:text-[32px] font-bold text-[#005c55] tracking-tight mb-2">
              Patient Tags
            </h1>
            <p className="text-[16px] text-[#3e4947]">
              Manage organizational tags and automation rules for clinical efficiency.
            </p>
          </header>

          <div className="hidden lg:flex items-center justify-between mb-6 shrink-0">
            <h2 className="text-[20px] font-semibold text-[#191c1e]">Existing Tags</h2>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7977]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tags..."
                  className="w-full h-10 pl-9 pr-4 bg-[#e6e8ea] border-0 focus-visible:ring-2 focus-visible:ring-[#005c55] rounded-full text-[14px] font-medium placeholder:text-[#6e7977]"
                />
              </div>
              <Button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="h-10 px-4 bg-[#005c55] hover:bg-[#004944] text-white rounded-full text-[14px] font-semibold"
              >
                <Plus className="w-4 h-4 mr-1" /> New Tag
              </Button>
            </div>
          </div>

          <h2 className="lg:hidden text-[12px] font-bold text-[#6e7977] uppercase tracking-wider mb-4 shrink-0">
            Existing Tags
          </h2>

          <div className="overflow-y-auto no-scrollbar pb-8 lg:pb-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#005c55]" />
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center py-12 text-[#6e7977]">
                <TagIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-[14px] font-medium">No tags found</p>
              </div>
            ) : (
              <>
                {/* Mobile Grid */}
                <div className="grid grid-cols-2 gap-3 lg:hidden">
                  {filteredTags.map(tag => (
                    <div
                      key={tag.id}
                      onClick={() => handleEdit(tag)}
                      className="bg-white rounded-xl shadow-[0_2px_10px_-2px_rgba(15,23,42,0.05)] border border-[#e0e3e5] p-4 flex items-center justify-between active:scale-95 transition-transform cursor-pointer"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_CLASSES[tag.color || '#6e7977'] || 'bg-[#6e7977]'}`} />
                        <span className="text-[14px] font-semibold text-[#191c1e] truncate">{tag.name}</span>
                      </div>
                      <Edit2 className="w-4 h-4 text-[#6e7977] shrink-0" />
                    </div>
                  ))}
                </div>

                {/* Desktop Grid */}
                <div className="hidden lg:grid grid-cols-2 gap-4 pr-2">
                  {filteredTags.map(tag => (
                    <div key={tag.id} className="bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-[#e0e3e5] p-5 flex flex-col justify-between hover:border-[#005c55] transition-colors group min-h-[140px]">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_CLASSES[tag.color || '#6e7977'] || 'bg-[#6e7977]'}`} />
                          <span className="text-[16px] font-semibold text-[#191c1e]">{tag.name}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 h-8">
                        <div />

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(tag)}
                            className="p-1.5 rounded-lg text-[#6e7977] hover:bg-[#f2f4f6] hover:text-[#005c55] transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tag)}
                            className="p-1.5 rounded-lg text-[#6e7977] hover:bg-[#ffdad6] hover:text-[#DC2626] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CREATE/EDIT TAG FORM */}
        {showForm && (
          <div className="w-full lg:w-[480px] shrink-0 flex flex-col bg-white lg:border lg:border-[#e0e3e5] lg:rounded-2xl lg:shadow-xl overflow-hidden mt-8 lg:mt-0 pb-32 lg:pb-0 relative z-10">
            <div className="flex-1 overflow-y-auto no-scrollbar p-5 lg:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="hidden lg:flex w-8 h-8 rounded-full bg-[#005c55]/10 items-center justify-center">
                    {editingTag ? <Edit2 className="w-5 h-5 text-[#005c55]" /> : <Plus className="w-5 h-5 text-[#005c55]" />}
                  </div>
                  <h2 className="text-[20px] font-bold text-[#191c1e]">{editingTag ? 'Edit Tag' : 'Create Tag'}</h2>
                </div>
                <button onClick={resetForm} className="p-2 rounded-lg hover:bg-[#f2f4f6] text-[#6e7977] transition-colors lg:hidden">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form className="space-y-6 lg:space-y-8" onSubmit={e => { e.preventDefault(); handleSave(); }}>
                {/* Tag Name */}
                <div className="space-y-2">
                  <label className="block text-[14px] font-semibold text-[#191c1e]">Tag Name</label>
                  <Input
                    value={editingTag ? editingTag.name : newTagName}
                    onChange={e => editingTag ? setEditingTag({ ...editingTag, name: e.target.value }) : setNewTagName(e.target.value)}
                    placeholder="e.g. Critical Follow-up"
                    className="w-full h-[48px] bg-[#f7f9fb] lg:bg-white border-[#e0e3e5] focus-visible:ring-[#005c55] text-[16px] rounded-xl px-4"
                  />
                </div>

                {/* Color Theme */}
                <div className="space-y-3">
                  <label className="block text-[14px] font-semibold text-[#191c1e]">Tag Color Theme</label>
                  <div className="flex flex-wrap gap-3 lg:gap-4">
                    {TAG_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setActiveColor(color)}
                        className={`w-10 h-10 lg:w-8 lg:h-8 rounded-full transition-all ${COLOR_CLASSES[color]} ${
                          activeColor === color
                            ? 'ring-2 ring-offset-2 ring-[#005c55] scale-110'
                            : 'hover:scale-110'
                        }`}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Auto Assign Toggle */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#191c1e]">Auto-assign by Rule</h3>
                      <p className="text-[12px] text-[#6e7977] mt-0.5 lg:hidden">Apply tag based on patient behavior</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isAutoAssign}
                        onChange={() => setIsAutoAssign(!isAutoAssign)}
                      />
                      <div className="w-11 h-6 bg-[#bdc9c6] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#005c55]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#005c55]"></div>
                    </label>
                  </div>

                  <div className={`transition-all duration-300 overflow-hidden ${isAutoAssign ? 'opacity-100 max-h-[500px]' : 'opacity-40 max-h-0 lg:max-h-[500px] pointer-events-none'}`}>
                    <div className="bg-[#f7f9fb] border border-[#e0e3e5] lg:border-dashed rounded-xl p-4 lg:p-5">
                      <div className="hidden lg:flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-[#005c55]" />
                        <h4 className="text-[14px] font-semibold text-[#191c1e]">Auto-assign by Rule</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-semibold text-[#191c1e] lg:text-[#6e7977]">IF</label>
                          <select className="w-full h-11 px-3 bg-white border border-[#e0e3e5] rounded-lg text-[14px] font-medium text-[#191c1e] focus:border-[#005c55] focus:ring-1 focus:ring-[#005c55] outline-none">
                            <option>Total Visits</option>
                            <option>Age Range</option>
                            <option>Last Visit Days Ago</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <select className="flex-1 h-11 px-3 bg-white border border-[#e0e3e5] rounded-lg text-[14px] font-medium text-[#191c1e] focus:border-[#005c55] focus:ring-1 focus:ring-[#005c55] outline-none">
                            <option>is equal to</option>
                            <option>greater than</option>
                            <option>less than</option>
                          </select>
                          <Input type="number" defaultValue="0" className="w-20 h-11 bg-white border-[#e0e3e5] text-center font-medium" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-semibold text-[#191c1e] uppercase tracking-wider">Then Apply Tag</label>
                          <div className="flex items-center gap-2 bg-[#005c55]/10 border border-[#005c55]/20 p-2 rounded-lg w-fit">
                            <div className={`w-2.5 h-2.5 rounded-full ${COLOR_CLASSES[activeColor] || 'bg-[#6e7977]'}`} />
                            <span className="text-[12px] font-bold text-[#005c55]">{editingTag?.name || newTagName || 'New Tag'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer Actions */}
            <div className="hidden lg:flex items-center gap-4 p-6 bg-white border-t border-[#e0e3e5] shrink-0">
              <Button
                onClick={handleSave}
                disabled={isSaving || !(editingTag ? editingTag.name : newTagName).trim()}
                className="flex-1 h-12 bg-[#005c55] hover:bg-[#004944] text-white rounded-full font-semibold text-[14px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editingTag ? 'Update Tag' : 'Save Tag'}
              </Button>
              <Button variant="outline" onClick={resetForm} className="px-8 h-12 border-[#bdc9c6] text-[#3e4947] hover:bg-[#f2f4f6] rounded-full font-semibold text-[14px] transition-colors">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE FIXED BOTTOM BAR */}
      {showForm && (
        <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-[#e0e3e5] p-4 z-50">
          <Button
            onClick={handleSave}
            disabled={isSaving || !(editingTag ? editingTag.name : newTagName).trim()}
            className="w-full h-[52px] bg-[#005c55] hover:bg-[#004944] text-white rounded-xl font-semibold text-[16px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {editingTag ? 'Update Tag' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
