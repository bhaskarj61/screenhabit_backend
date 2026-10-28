CREATE TABLE app_config (
 id integer PRIMARY KEY CHECK(id=1),
 minimum_version_code integer NOT NULL DEFAULT 1 CHECK(minimum_version_code>0),
 latest_version_code integer NOT NULL DEFAULT 17 CHECK(latest_version_code>=minimum_version_code),
 update_message varchar(300) NOT NULL DEFAULT '',
 features jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(features)='object'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_config(id,features) VALUES(1,'{"aiCoach":false,"subscriptions":false}');
CREATE TABLE feedback (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 category varchar(20) NOT NULL CHECK(category IN ('bug','suggestion','general')),
 message varchar(2000) NOT NULL CHECK(length(trim(message))>0),
 app_version varchar(40),
 platform varchar(20) NOT NULL CHECK(platform='android'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_created_at_idx ON feedback(created_at);
