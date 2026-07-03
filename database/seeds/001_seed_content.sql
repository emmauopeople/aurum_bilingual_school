BEGIN;

INSERT INTO workshops (title, slug, summary, description, display_order, status)
VALUES
('Electrical Engineering','electrical-engineering','Practical exposure to basic electrical concepts, safety, wiring, and hands-on technical learning.','Students explore foundational electrical engineering concepts through guided practical sessions. The workshop emphasizes safety, simple wiring, tools, and confidence in technical learning.',1,'published'),
('Wood Works','wood-works','Hands-on wood work activities that build creativity, accuracy, and practical technical skills.','The wood works program introduces measurement, planning, tool safety, and basic construction techniques. Students learn by creating useful items and developing craftsmanship.',2,'published'),
('Building and Construction','building-and-construction','A practical workshop introducing building concepts, teamwork, materials, and construction safety.','Students learn the basics of building and construction through demonstrations and supervised activities. The module promotes teamwork, planning, and respect for safety standards.',3,'published')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO events (title, slug, summary, body, event_date, location, status, published_at)
VALUES ('Parent Orientation Day','parent-orientation-day','A welcoming session for parents to learn about the school vision, programs, and expectations.','Aurum Bilingual School invites parents and guardians to orientation day. The session will introduce school leadership, academic expectations, communication channels, and the role of parents in supporting student success.',CURRENT_DATE + INTERVAL '14 days','Aurum Bilingual School Campus','published',now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO announcements (title, slug, summary, body, status, published_at)
VALUES ('Admissions Are Open','admissions-are-open','Applications are now open for new students.','Aurum Bilingual School is accepting applications for the new academic year. Parents are encouraged to review the admissions page and contact the school for requirements and next steps.','published',now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO student_activities (title, slug, summary, body, activity_date, status, published_at)
VALUES ('Student Practical Learning Showcase','student-practical-learning-showcase','Students demonstrate creativity, confidence, and hands-on learning through practical activities.','The practical learning showcase highlights student work across classroom and workshop activities. The activity supports confidence, collaboration, communication, and real-world skill development.',CURRENT_DATE,'published',now())
ON CONFLICT (slug) DO NOTHING;

COMMIT;
