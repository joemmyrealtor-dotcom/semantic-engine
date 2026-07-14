
-- =====================================================================
-- ENUMS
-- =====================================================================
CREATE TYPE public.app_role AS ENUM ('owner','editor','reviewer','contributor','viewer');
CREATE TYPE public.asset_status AS ENUM ('Draft','In Review','Approved','Canonical','Deprecated','Archived');
CREATE TYPE public.release_stage AS ENUM ('Planned','Build','Review','QA','Release Candidate','Canonical','Archived');
CREATE TYPE public.review_state AS ENUM ('Pending','Approved','Changes Requested','Rejected');
CREATE TYPE public.qa_severity AS ENUM ('info','warning','error','blocker');

-- =====================================================================
-- UPDATED_AT TRIGGER
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- PROFILES
-- =====================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- USER ROLES
-- =====================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "roles owner manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

-- =====================================================================
-- AUTO PROFILE + DEFAULT ROLE ON SIGNUP (first user = owner)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- SHARED HELPER: write access = owner/editor/reviewer/contributor
-- =====================================================================
-- Read = any authenticated
-- Write = has_any_role([owner,editor,reviewer,contributor])
-- Approve/promote = has_any_role([owner,reviewer]) (releases: owner only)

-- =====================================================================
-- DOMAINS
-- =====================================================================
CREATE TABLE public.domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  steward TEXT,
  status asset_status NOT NULL DEFAULT 'Draft',
  version TEXT NOT NULL DEFAULT '0.1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domains TO authenticated;
GRANT ALL ON public.domains TO service_role;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domains read" ON public.domains FOR SELECT TO authenticated USING (true);
CREATE POLICY "domains write" ON public.domains FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "domains update" ON public.domains FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));
CREATE POLICY "domains delete" ON public.domains FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER domains_updated_at BEFORE UPDATE ON public.domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- CONCEPTS
-- =====================================================================
CREATE TABLE public.concepts (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  canonical_definition TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '',
  exclusions TEXT NOT NULL DEFAULT '',
  domain_ids TEXT[] NOT NULL DEFAULT '{}',
  aliases TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  related_concept_ids TEXT[] NOT NULL DEFAULT '{}',
  framework_ids TEXT[] NOT NULL DEFAULT '{}',
  audience TEXT,
  reading_level TEXT,
  ai_retrieval_tags TEXT[] NOT NULL DEFAULT '{}',
  steward TEXT,
  status asset_status NOT NULL DEFAULT 'Draft',
  version TEXT NOT NULL DEFAULT '0.1.0',
  review_cadence_months INT NOT NULL DEFAULT 12,
  last_reviewed_at TIMESTAMPTZ,
  human_review_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concepts TO authenticated;
GRANT ALL ON public.concepts TO service_role;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "concepts read" ON public.concepts FOR SELECT TO authenticated USING (true);
CREATE POLICY "concepts insert" ON public.concepts FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "concepts update" ON public.concepts FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));
CREATE POLICY "concepts delete" ON public.concepts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER concepts_updated_at BEFORE UPDATE ON public.concepts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- FRAMEWORKS
-- =====================================================================
CREATE TABLE public.frameworks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mission TEXT NOT NULL DEFAULT '',
  decision_solved TEXT NOT NULL DEFAULT '',
  governing_concept_ids TEXT[] NOT NULL DEFAULT '{}',
  inputs TEXT[] NOT NULL DEFAULT '{}',
  outputs TEXT[] NOT NULL DEFAULT '{}',
  decision_flow TEXT[] NOT NULL DEFAULT '{}',
  dependency_ids TEXT[] NOT NULL DEFAULT '{}',
  client_tool_ids TEXT[] NOT NULL DEFAULT '{}',
  publication_ids TEXT[] NOT NULL DEFAULT '{}',
  maturity TEXT NOT NULL DEFAULT 'Emerging',
  status asset_status NOT NULL DEFAULT 'Draft',
  version TEXT NOT NULL DEFAULT '0.1.0',
  steward TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frameworks TO authenticated;
GRANT ALL ON public.frameworks TO service_role;
ALTER TABLE public.frameworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frameworks read" ON public.frameworks FOR SELECT TO authenticated USING (true);
CREATE POLICY "frameworks insert" ON public.frameworks FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "frameworks update" ON public.frameworks FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));
CREATE POLICY "frameworks delete" ON public.frameworks FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER frameworks_updated_at BEFORE UPDATE ON public.frameworks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- KNOWLEDGE OBJECTS
-- =====================================================================
CREATE TABLE public.knowledge_objects (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  source_concept_ids TEXT[] NOT NULL DEFAULT '{}',
  source_framework_ids TEXT[] NOT NULL DEFAULT '{}',
  prompt_id TEXT,
  generated_at TIMESTAMPTZ,
  human_review_required BOOLEAN NOT NULL DEFAULT true,
  human_review_completed BOOLEAN NOT NULL DEFAULT false,
  audience TEXT,
  status asset_status NOT NULL DEFAULT 'Draft',
  version TEXT NOT NULL DEFAULT '0.1.0',
  steward TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_objects TO authenticated;
GRANT ALL ON public.knowledge_objects TO service_role;
ALTER TABLE public.knowledge_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ko read" ON public.knowledge_objects FOR SELECT TO authenticated USING (true);
CREATE POLICY "ko insert" ON public.knowledge_objects FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "ko update" ON public.knowledge_objects FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));
CREATE POLICY "ko delete" ON public.knowledge_objects FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER ko_updated_at BEFORE UPDATE ON public.knowledge_objects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Governance guard: AI-generated content cannot leave Draft without human review
CREATE OR REPLACE FUNCTION public.enforce_ko_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.prompt_id IS NOT NULL
     AND NEW.status <> 'Draft'
     AND NEW.human_review_completed = false THEN
    RAISE EXCEPTION 'AI-generated knowledge object % must complete human review before leaving Draft', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ko_governance BEFORE INSERT OR UPDATE ON public.knowledge_objects FOR EACH ROW EXECUTE FUNCTION public.enforce_ko_governance();

-- =====================================================================
-- CLIENT TOOLS
-- =====================================================================
CREATE TABLE public.client_tools (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  source_concept_ids TEXT[] NOT NULL DEFAULT '{}',
  source_framework_ids TEXT[] NOT NULL DEFAULT '{}',
  source_knowledge_object_ids TEXT[] NOT NULL DEFAULT '{}',
  prompt_id TEXT,
  status asset_status NOT NULL DEFAULT 'Draft',
  version TEXT NOT NULL DEFAULT '0.1.0',
  human_review_completed BOOLEAN NOT NULL DEFAULT false,
  steward TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_tools TO authenticated;
GRANT ALL ON public.client_tools TO service_role;
ALTER TABLE public.client_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tools read" ON public.client_tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "tools insert" ON public.client_tools FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "tools update" ON public.client_tools FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));
CREATE POLICY "tools delete" ON public.client_tools FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER tools_updated_at BEFORE UPDATE ON public.client_tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- PUBLICATION BLUEPRINTS (chapters as JSONB)
-- =====================================================================
CREATE TABLE public.publication_blueprints (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  audience TEXT,
  purpose TEXT NOT NULL DEFAULT '',
  chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
  status asset_status NOT NULL DEFAULT 'Draft',
  version TEXT NOT NULL DEFAULT '0.1.0',
  steward TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_blueprints TO authenticated;
GRANT ALL ON public.publication_blueprints TO service_role;
ALTER TABLE public.publication_blueprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pubs read" ON public.publication_blueprints FOR SELECT TO authenticated USING (true);
CREATE POLICY "pubs insert" ON public.publication_blueprints FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "pubs update" ON public.publication_blueprints FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));
CREATE POLICY "pubs delete" ON public.publication_blueprints FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER pubs_updated_at BEFORE UPDATE ON public.publication_blueprints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- PROMPTS
-- =====================================================================
CREATE TABLE public.prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL DEFAULT '',
  inputs TEXT[] NOT NULL DEFAULT '{}',
  outputs TEXT[] NOT NULL DEFAULT '{}',
  version TEXT NOT NULL DEFAULT '0.1.0',
  status asset_status NOT NULL DEFAULT 'Draft',
  steward TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO authenticated;
GRANT ALL ON public.prompts TO service_role;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompts read" ON public.prompts FOR SELECT TO authenticated USING (true);
CREATE POLICY "prompts insert" ON public.prompts FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "prompts update" ON public.prompts FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));
CREATE POLICY "prompts delete" ON public.prompts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER prompts_updated_at BEFORE UPDATE ON public.prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- AGENTS
-- =====================================================================
CREATE TABLE public.agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  governing_prompt_ids TEXT[] NOT NULL DEFAULT '{}',
  status asset_status NOT NULL DEFAULT 'Draft',
  version TEXT NOT NULL DEFAULT '0.1.0',
  steward TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents read" ON public.agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "agents insert" ON public.agents FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "agents update" ON public.agents FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));
CREATE POLICY "agents delete" ON public.agents FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- RELATIONSHIPS
-- =====================================================================
CREATE TABLE public.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, target_type, target_id, relation)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationships TO authenticated;
GRANT ALL ON public.relationships TO service_role;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rel read" ON public.relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "rel write" ON public.relationships FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));

-- =====================================================================
-- REVIEW ITEMS
-- =====================================================================
CREATE TABLE public.review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  state review_state NOT NULL DEFAULT 'Pending',
  notes TEXT,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_items TO authenticated;
GRANT ALL ON public.review_items TO service_role;
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review read" ON public.review_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "review insert" ON public.review_items FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "review decide" ON public.review_items FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','reviewer']::app_role[]));
CREATE POLICY "review delete" ON public.review_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER review_updated_at BEFORE UPDATE ON public.review_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- QA ISSUES
-- =====================================================================
CREATE TABLE public.qa_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  severity qa_severity NOT NULL DEFAULT 'warning',
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  blocking BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_issues TO authenticated;
GRANT ALL ON public.qa_issues TO service_role;
ALTER TABLE public.qa_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa read" ON public.qa_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "qa insert" ON public.qa_issues FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));
CREATE POLICY "qa resolve" ON public.qa_issues FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','reviewer']::app_role[]));
CREATE POLICY "qa delete" ON public.qa_issues FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER qa_updated_at BEFORE UPDATE ON public.qa_issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- RELEASES
-- =====================================================================
CREATE TABLE public.releases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stage release_stage NOT NULL DEFAULT 'Planned',
  version TEXT NOT NULL,
  manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  changelog TEXT[] NOT NULL DEFAULT '{}',
  release_notes TEXT NOT NULL DEFAULT '',
  validation_summary TEXT NOT NULL DEFAULT '',
  editorial_review TEXT NOT NULL DEFAULT '',
  qa_evidence TEXT NOT NULL DEFAULT '',
  traceability TEXT NOT NULL DEFAULT '',
  known_issues TEXT[] NOT NULL DEFAULT '{}',
  migration_notes TEXT NOT NULL DEFAULT '',
  gate_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocking_errors INT NOT NULL DEFAULT 0,
  alignment_warnings INT NOT NULL DEFAULT 0,
  steward TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.releases TO authenticated;
GRANT ALL ON public.releases TO service_role;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rel_r read" ON public.releases FOR SELECT TO authenticated USING (true);
CREATE POLICY "rel_r insert" ON public.releases FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer']::app_role[]));
CREATE POLICY "rel_r update" ON public.releases FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','reviewer']::app_role[]));
CREATE POLICY "rel_r delete" ON public.releases FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER releases_updated_at BEFORE UPDATE ON public.releases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Release gate: block promotion to Canonical when errors or unresolved blockers exist
CREATE OR REPLACE FUNCTION public.enforce_release_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  open_blockers INT;
BEGIN
  IF NEW.stage = 'Canonical' AND (OLD.stage IS DISTINCT FROM 'Canonical') THEN
    IF NEW.blocking_errors > 0 THEN
      RAISE EXCEPTION 'Release % cannot be promoted: % blocking errors', NEW.id, NEW.blocking_errors;
    END IF;
    SELECT count(*) INTO open_blockers FROM public.qa_issues WHERE blocking = true AND resolved = false;
    IF open_blockers > 0 THEN
      RAISE EXCEPTION 'Release % cannot be promoted: % unresolved blocking QA issues', NEW.id, open_blockers;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER release_gate BEFORE UPDATE ON public.releases FOR EACH ROW EXECUTE FUNCTION public.enforce_release_gate();

-- =====================================================================
-- REVISIONS (entity history snapshots)
-- =====================================================================
CREATE TABLE public.revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  author UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.revisions TO authenticated;
GRANT ALL ON public.revisions TO service_role;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev read" ON public.revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rev insert" ON public.revisions FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','editor','reviewer','contributor']::app_role[]));

-- =====================================================================
-- AUDIT EVENTS
-- =====================================================================
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit insert" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================================
-- INDEXES
-- =====================================================================
CREATE INDEX idx_concepts_status ON public.concepts(status);
CREATE INDEX idx_frameworks_status ON public.frameworks(status);
CREATE INDEX idx_ko_status ON public.knowledge_objects(status);
CREATE INDEX idx_ko_prompt ON public.knowledge_objects(prompt_id) WHERE prompt_id IS NOT NULL;
CREATE INDEX idx_rel_source ON public.relationships(source_type, source_id);
CREATE INDEX idx_rel_target ON public.relationships(target_type, target_id);
CREATE INDEX idx_review_state ON public.review_items(state);
CREATE INDEX idx_qa_open ON public.qa_issues(resolved, blocking);
CREATE INDEX idx_audit_target ON public.audit_events(target_type, target_id);
