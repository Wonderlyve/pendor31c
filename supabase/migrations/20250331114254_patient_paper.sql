/*
  # Add news table and functionality

  1. New Tables
    - `news`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `title` (text)
      - `source` (text, nullable)
      - `content` (text)
      - `image_url` (text, nullable)
      - `created_at` (timestamp with timezone)
      - `likes` (integer)
      - `comments` (integer)
      - `shares` (integer)

  2. Security
    - Enable RLS
    - Add policies for:
      - Public can read all news
      - Authenticated users can create news
      - Users can update/delete their own news
*/

CREATE TABLE IF NOT EXISTS news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  source text,
  content text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now(),
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "News are viewable by everyone"
  ON news
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create news"
  ON news
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own news"
  ON news
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own news"
  ON news
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create news_likes table
CREATE TABLE IF NOT EXISTS news_likes (
  news_id uuid REFERENCES news(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (news_id, user_id)
);

-- Enable RLS for news_likes
ALTER TABLE news_likes ENABLE ROW LEVEL SECURITY;

-- News likes policies
CREATE POLICY "News likes are viewable by everyone"
  ON news_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like news"
  ON news_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike news"
  ON news_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update news likes count
CREATE OR REPLACE FUNCTION update_news_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE news SET likes = likes + 1 WHERE id = NEW.news_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE news SET likes = likes - 1 WHERE id = OLD.news_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for news likes count updates
CREATE TRIGGER news_likes_count_update
  AFTER INSERT OR DELETE ON news_likes
  FOR EACH ROW EXECUTE FUNCTION update_news_likes_count();