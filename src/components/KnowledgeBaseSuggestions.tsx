import React, { useState, useEffect } from 'react';
import { Book, ChevronRight, ExternalLink, Lightbulb, X, ArrowRight } from 'lucide-react';
import { KnowledgeBaseArticle } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface KnowledgeBaseSuggestionsProps {
  query: string;
  onLinkArticle?: (article: KnowledgeBaseArticle) => void;
}

export const KnowledgeBaseSuggestions: React.FC<KnowledgeBaseSuggestionsProps> = ({ query, onLinkArticle }) => {
  const [suggestions, setSuggestions] = useState<KnowledgeBaseArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);

  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/kb/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (error) {
        console.error('Error fetching KB suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  if (suggestions.length === 0 && !isLoading && !selectedArticle) return null;

  return (
    <div className="mt-4">
      <AnimatePresence mode="wait">
        {selectedArticle ? (
          <motion.div
            key="article-detail"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 bg-white rounded-2xl border border-indigo-200 shadow-lg dark:bg-[#1C1C1E] dark:border-indigo-900/40"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Book className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-gray-900 dark:text-white">{selectedArticle.title}</h4>
              </div>
              <button 
                onClick={() => setSelectedArticle(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                {selectedArticle.content}
              </p>
            </div>
            <div className="flex gap-3">
              {onLinkArticle && (
                <button
                  onClick={() => {
                    onLinkArticle(selectedArticle);
                    setSelectedArticle(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Link to Ticket
                </button>
              )}
              <button
                onClick={() => setSelectedArticle(null)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all dark:border-gray-800 dark:text-gray-400"
              >
                Back to Suggestions
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="suggestions-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30"
          >
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Suggested Solutions</h4>
            </div>
            
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-indigo-400 py-2">
                  <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Searching knowledge base...
                </div>
              ) : (
                suggestions.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => setSelectedArticle(article)}
                    className="group bg-white p-3 rounded-xl border border-indigo-100 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer dark:bg-[#1C1C1E] dark:border-indigo-900/20"
                  >
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5 group-hover:text-indigo-600 transition-colors truncate">{article.title}</h5>
                        <p className="text-[10px] text-gray-500 line-clamp-1">{article.content}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-all transform group-hover:translate-x-1" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
