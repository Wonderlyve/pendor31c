import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  odds: number;
  confidence: number;
  created_at: string;
  likes: number;
  comments: number;
  shares: number;
  user: {
    username: string;
    avatar_url: string;
  };
}

interface News {
  id: string;
  title: string;
  source: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
  likes: number;
  comments: number;
  shares: number;
  user: {
    username: string;
    avatar_url: string;
  };
}

interface PostContextType {
  posts: (Post | News)[];
  loading: boolean;
  hasMore: boolean;
  addPost: (post: { text: string; image: string | null; totalOdds: string; confidence: number }) => Promise<void>;
  addNews: (news: { title: string; source: string; content: string; image: string | null }) => Promise<void>;
  fetchMorePosts: () => Promise<void>;
}

const PostContext = createContext<PostContextType | undefined>(undefined);

const POSTS_PER_PAGE = 20;

export function PostProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<(Post | News)[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchMorePosts = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      // Fetch both posts and news
      const [postsResponse, newsResponse] = await Promise.all([
        supabase
          .from('posts')
          .select(`
            *,
            user:profiles(username, avatar_url)
          `)
          .range(page * POSTS_PER_PAGE, (page + 1) * POSTS_PER_PAGE - 1)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('news')
          .select(`
            *,
            user:profiles(username, avatar_url)
          `)
          .range(page * POSTS_PER_PAGE, (page + 1) * POSTS_PER_PAGE - 1)
          .order('created_at', { ascending: false })
      ]);

      if (postsResponse.error) throw postsResponse.error;
      if (newsResponse.error) throw newsResponse.error;

      // Combine and sort posts and news by creation date
      const allContent = [...(postsResponse.data || []), ...(newsResponse.data || [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Dédupliquer le contenu
      const uniqueContent = allContent.filter(
        newItem => !posts.some(existingItem => existingItem.id === newItem.id)
      );
      
      setPosts(prev => [...prev, ...uniqueContent]);
      setHasMore(uniqueContent.length === POSTS_PER_PAGE);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, posts]);

  const addPost = async (newPost: { text: string; image: string | null; totalOdds: string; confidence: number }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const oddsString = (newPost.totalOdds || '0').replace(',', '.');
      const odds = parseFloat(oddsString);
      
      if (isNaN(odds)) {
        throw new Error('Invalid odds value');
      }

      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            content: newPost.text,
            image_url: newPost.image,
            odds: odds,
            confidence: newPost.confidence,
            user_id: user.id,
            likes: 0,
            comments: 0,
            shares: 0
          }
        ])
        .select(`
          *,
          user:profiles(username, avatar_url)
        `)
        .single();

      if (error) throw error;

      if (data) {
        setPosts(prev => [data, ...prev]);
      }
    } catch (error) {
      console.error('Error adding post:', error);
      throw error;
    }
  };

  const addNews = async (newNews: { title: string; source: string; content: string; image: string | null }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('news')
        .insert([
          {
            title: newNews.title,
            source: newNews.source || null,
            content: newNews.content,
            image_url: newNews.image,
            user_id: user.id,
            likes: 0,
            comments: 0,
            shares: 0
          }
        ])
        .select(`
          *,
          user:profiles(username, avatar_url)
        `)
        .single();

      if (error) throw error;

      if (data) {
        setPosts(prev => [data, ...prev]);
      }
    } catch (error) {
      console.error('Error adding news:', error);
      throw error;
    }
  };

  return (
    <PostContext.Provider value={{ posts, loading, hasMore, addPost, addNews, fetchMorePosts }}>
      {children}
    </PostContext.Provider>
  );
}

export function usePosts() {
  const context = useContext(PostContext);
  if (context === undefined) {
    throw new Error('usePosts must be used within a PostProvider');
  }
  return context;
}