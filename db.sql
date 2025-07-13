CREATE DATABASE drakor;
USE drakor;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  email VARCHAR(255),
  phone VARCHAR(20),
  password VARCHAR(255),
  role ENUM('admin','user') NOT NULL DEFAULT 'user'
);

CREATE TABLE videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255),
  episode VARCHAR(50),
  filename VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scrape_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  channel_name VARCHAR(255),
  label VARCHAR(255),
  status ENUM('pending','in_progress','done') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin
INSERT INTO users(username,email,phone,password,role) VALUES (
 'admin','admin@example.com','+628123456','${SHA2('admin123',256)}','admin'
);
