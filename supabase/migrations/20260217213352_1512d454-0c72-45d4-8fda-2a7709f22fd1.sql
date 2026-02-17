
-- Add language column to units
ALTER TABLE public.units ADD COLUMN language text NOT NULL DEFAULT 'spanish';

-- Create index for language filtering
CREATE INDEX idx_units_language ON public.units(language);

-- Seed Spanish units
INSERT INTO public.units (title, description, icon, order_index, language) VALUES
('Greetings & Basics', 'Learn essential Spanish greetings and introductions', '👋', 1, 'spanish'),
('Numbers & Colors', 'Master numbers 1-100 and common colors', '🔢', 2, 'spanish'),
('Food & Drinks', 'Order food and talk about meals', '🍽️', 3, 'spanish'),
('Family & People', 'Describe family members and relationships', '👨‍👩‍👧‍👦', 4, 'spanish'),
('Travel & Directions', 'Navigate cities and ask for directions', '✈️', 5, 'spanish'),
('Daily Routines', 'Talk about your day and daily habits', '☀️', 6, 'spanish');

-- Seed French units
INSERT INTO public.units (title, description, icon, order_index, language) VALUES
('Salutations & Bases', 'Learn essential French greetings and introductions', '👋', 1, 'french'),
('Nombres & Couleurs', 'Master numbers 1-100 and common colors', '🔢', 2, 'french'),
('Nourriture & Boissons', 'Order food and talk about meals', '🍽️', 3, 'french'),
('Famille & Relations', 'Describe family members and relationships', '👨‍👩‍👧‍👦', 4, 'french'),
('Voyages & Directions', 'Navigate cities and ask for directions', '✈️', 5, 'french'),
('Routine Quotidienne', 'Talk about your day and daily habits', '☀️', 6, 'french');

-- Seed Italian units
INSERT INTO public.units (title, description, icon, order_index, language) VALUES
('Saluti & Basi', 'Learn essential Italian greetings and introductions', '👋', 1, 'italian'),
('Numeri & Colori', 'Master numbers 1-100 and common colors', '🔢', 2, 'italian'),
('Cibo & Bevande', 'Order food and talk about meals', '🍽️', 3, 'italian'),
('Famiglia & Persone', 'Describe family members and relationships', '👨‍👩‍👧‍👦', 4, 'italian'),
('Viaggi & Indicazioni', 'Navigate cities and ask for directions', '✈️', 5, 'italian'),
('Routine Giornaliera', 'Talk about your day and daily habits', '☀️', 6, 'italian');

-- Seed English units
INSERT INTO public.units (title, description, icon, order_index, language) VALUES
('Greetings & Basics', 'Learn essential English greetings and introductions', '👋', 1, 'english'),
('Numbers & Colors', 'Master numbers 1-100 and common colors', '🔢', 2, 'english'),
('Food & Drinks', 'Order food and talk about meals', '🍽️', 3, 'english'),
('Family & People', 'Describe family members and relationships', '👨‍👩‍👧‍👦', 4, 'english'),
('Travel & Directions', 'Navigate cities and ask for directions', '✈️', 5, 'english'),
('Daily Routines', 'Talk about your day and daily habits', '☀️', 6, 'english');
