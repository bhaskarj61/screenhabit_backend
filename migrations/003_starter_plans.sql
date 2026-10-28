CREATE TABLE starter_plans (
 id varchar(60) PRIMARY KEY,
 title varchar(100) NOT NULL,
 description varchar(400) NOT NULL,
 minutes integer NOT NULL CHECK(minutes BETWEEN 5 AND 1440),
 activity varchar(50) NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 position integer NOT NULL DEFAULT 0
);
INSERT INTO starter_plans(id,title,description,minutes,activity,position) VALUES
('gentle-start','A gentler start','Choose one app and try a comfortable 30-minute daily budget.',30,'Read',1),
('make-room','Make room for a hobby','Try a 45-minute app budget and a short session doing something you enjoy.',45,'Hobby',2),
('evening-reset','A calmer evening','Set a 20-minute daily budget for one distracting app, then reflect tonight.',20,'Unwind',3),
('small-step','One small step','Begin with a flexible 60-minute app budget. Adjust it to suit your day.',60,'Walk',4);
