import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, Calendar, User, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SearchResult {
  id: string;
  message_id: string;
  conversation_id: string;
  content_preview: string;
  content: string;
  created_at: string;
  sender_id: string;
  message_type: string;
  similarity: number;
}

interface SearchFilters {
  conversationId?: string;
  senderId?: string;
  startDate?: string;
  endDate?: string;
  messageType?: string;
}

interface SemanticSearchProps {
  onResultClick?: (conversationId: string, messageId: string) => void;
}

const SemanticSearch = ({ onResultClick }: SemanticSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasPremium, setHasPremium] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: 'Empty query',
        description: 'Please enter a search query',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('semantic-search', {
        body: {
          query: query.trim(),
          filters: hasPremium ? filters : undefined,
          limit: 10,
        },
      });

      if (error) throw error;

      setResults(data.results || []);
      setHasPremium(data.hasPremium);

      if (data.results?.length === 0) {
        toast({
          title: 'No results found',
          description: 'Try rephrasing your search query',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'Failed to perform search',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Semantic Search
          </CardTitle>
          <CardDescription>
            Search by meaning, not just keywords. Find messages, media, and conversations contextually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="What are you looking for? (e.g., 'conversations about project deadlines')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {hasPremium && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide' : 'Show'} Advanced Filters
                <Badge variant="secondary" className="ml-2">Premium</Badge>
              </Button>

              {showFilters && (
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <Input
                      type="date"
                      value={filters.startDate || ''}
                      onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">End Date</label>
                    <Input
                      type="date"
                      value={filters.endDate || ''}
                      onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Message Type</label>
                    <select
                      className="w-full p-2 border rounded"
                      value={filters.messageType || ''}
                      onChange={(e) => setFilters({ ...filters, messageType: e.target.value })}
                    >
                      <option value="">All Types</option>
                      <option value="text">Text</option>
                      <option value="audio">Audio</option>
                      <option value="image">Image</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasPremium && results.length > 0 && (
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Upgrade to <Badge variant="secondary">Premium</Badge> to unlock advanced filters (date range, sender, message type) and enterprise team search.
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Search Results ({results.length})</h3>
          {results.map((result) => (
            <Card
              key={result.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => onResultClick?.(result.conversation_id, result.message_id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <p className="text-sm">{result.content || result.content_preview}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(result.created_at), 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {result.message_type}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {Math.round(result.similarity * 100)}% match
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SemanticSearch;
