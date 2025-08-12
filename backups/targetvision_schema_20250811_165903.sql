--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Homebrew)
-- Dumped by pg_dump version 15.13 (Homebrew)

-- Started on 2025-08-11 16:59:03 EDT

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 232 (class 1255 OID 16441)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: shelbyklein
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO shelbyklein;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 16445)
-- Name: ai_metadata; Type: TABLE; Schema: public; Owner: shelbyklein
--

CREATE TABLE public.ai_metadata (
    id integer NOT NULL,
    photo_id integer,
    description text,
    ai_keywords text[],
    confidence_score double precision,
    processing_time double precision,
    model_version character varying(100),
    processed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    approved boolean DEFAULT false,
    approved_at timestamp with time zone,
    embedding real[]
);


ALTER TABLE public.ai_metadata OWNER TO shelbyklein;

--
-- TOC entry 220 (class 1259 OID 16444)
-- Name: ai_metadata_id_seq; Type: SEQUENCE; Schema: public; Owner: shelbyklein
--

CREATE SEQUENCE public.ai_metadata_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ai_metadata_id_seq OWNER TO shelbyklein;

--
-- TOC entry 3922 (class 0 OID 0)
-- Dependencies: 220
-- Name: ai_metadata_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: shelbyklein
--

ALTER SEQUENCE public.ai_metadata_id_seq OWNED BY public.ai_metadata.id;


--
-- TOC entry 223 (class 1259 OID 16493)
-- Name: album_cache; Type: TABLE; Schema: public; Owner: shelbyklein
--

CREATE TABLE public.album_cache (
    id integer NOT NULL,
    cache_key character varying(100) NOT NULL,
    album_data text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.album_cache OWNER TO shelbyklein;

--
-- TOC entry 222 (class 1259 OID 16492)
-- Name: album_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: shelbyklein
--

CREATE SEQUENCE public.album_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.album_cache_id_seq OWNER TO shelbyklein;

--
-- TOC entry 3923 (class 0 OID 0)
-- Dependencies: 222
-- Name: album_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: shelbyklein
--

ALTER SEQUENCE public.album_cache_id_seq OWNED BY public.album_cache.id;


--
-- TOC entry 227 (class 1259 OID 16642)
-- Name: albums; Type: TABLE; Schema: public; Owner: shelbyklein
--

CREATE TABLE public.albums (
    id integer NOT NULL,
    smugmug_id character varying(255) NOT NULL,
    smugmug_uri character varying(500),
    title character varying(255),
    description text,
    keywords text[] DEFAULT '{}'::text[],
    photo_count integer DEFAULT 0,
    image_count integer DEFAULT 0,
    video_count integer DEFAULT 0,
    album_key character varying(255),
    url_name character varying(255),
    privacy character varying(50),
    security_type character varying(50),
    sort_method character varying(50),
    sort_direction character varying(10),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone
);


ALTER TABLE public.albums OWNER TO shelbyklein;

--
-- TOC entry 226 (class 1259 OID 16641)
-- Name: albums_id_seq; Type: SEQUENCE; Schema: public; Owner: shelbyklein
--

CREATE SEQUENCE public.albums_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.albums_id_seq OWNER TO shelbyklein;

--
-- TOC entry 3924 (class 0 OID 0)
-- Dependencies: 226
-- Name: albums_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: shelbyklein
--

ALTER SEQUENCE public.albums_id_seq OWNED BY public.albums.id;


--
-- TOC entry 231 (class 1259 OID 16679)
-- Name: collection_items; Type: TABLE; Schema: public; Owner: shelbyklein
--

CREATE TABLE public.collection_items (
    id integer NOT NULL,
    collection_id integer NOT NULL,
    photo_id integer NOT NULL,
    added_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.collection_items OWNER TO shelbyklein;

--
-- TOC entry 230 (class 1259 OID 16678)
-- Name: collection_items_id_seq; Type: SEQUENCE; Schema: public; Owner: shelbyklein
--

CREATE SEQUENCE public.collection_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.collection_items_id_seq OWNER TO shelbyklein;

--
-- TOC entry 3925 (class 0 OID 0)
-- Dependencies: 230
-- Name: collection_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: shelbyklein
--

ALTER SEQUENCE public.collection_items_id_seq OWNED BY public.collection_items.id;


--
-- TOC entry 229 (class 1259 OID 16664)
-- Name: collections; Type: TABLE; Schema: public; Owner: shelbyklein
--

CREATE TABLE public.collections (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    cover_photo_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone
);


ALTER TABLE public.collections OWNER TO shelbyklein;

--
-- TOC entry 228 (class 1259 OID 16663)
-- Name: collections_id_seq; Type: SEQUENCE; Schema: public; Owner: shelbyklein
--

CREATE SEQUENCE public.collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.collections_id_seq OWNER TO shelbyklein;

--
-- TOC entry 3926 (class 0 OID 0)
-- Dependencies: 228
-- Name: collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: shelbyklein
--

ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;


--
-- TOC entry 217 (class 1259 OID 16403)
-- Name: oauth_tokens; Type: TABLE; Schema: public; Owner: shelbyklein
--

CREATE TABLE public.oauth_tokens (
    id integer NOT NULL,
    service character varying(50) DEFAULT 'smugmug'::character varying,
    access_token text NOT NULL,
    access_token_secret text NOT NULL,
    user_id character varying(255),
    username character varying(255),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.oauth_tokens OWNER TO shelbyklein;

--
-- TOC entry 216 (class 1259 OID 16402)
-- Name: oauth_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: shelbyklein
--

CREATE SEQUENCE public.oauth_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.oauth_tokens_id_seq OWNER TO shelbyklein;

--
-- TOC entry 3927 (class 0 OID 0)
-- Dependencies: 216
-- Name: oauth_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: shelbyklein
--

ALTER SEQUENCE public.oauth_tokens_id_seq OWNED BY public.oauth_tokens.id;


--
-- TOC entry 215 (class 1259 OID 16390)
-- Name: photos; Type: TABLE; Schema: public; Owner: shelbyklein
--

CREATE TABLE public.photos (
    id integer NOT NULL,
    smugmug_id character varying(255) NOT NULL,
    smugmug_uri character varying(500),
    image_url text,
    thumbnail_url text,
    title character varying(255),
    caption text,
    keywords text[],
    album_name character varying(255),
    album_uri character varying(500),
    width integer,
    height integer,
    format character varying(50),
    file_size integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    album_id integer,
    processing_status character varying(50) DEFAULT 'not_processed'::character varying
);


ALTER TABLE public.photos OWNER TO shelbyklein;

--
-- TOC entry 214 (class 1259 OID 16389)
-- Name: photos_id_seq; Type: SEQUENCE; Schema: public; Owner: shelbyklein
--

CREATE SEQUENCE public.photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.photos_id_seq OWNER TO shelbyklein;

--
-- TOC entry 3928 (class 0 OID 0)
-- Dependencies: 214
-- Name: photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: shelbyklein
--

ALTER SEQUENCE public.photos_id_seq OWNED BY public.photos.id;


--
-- TOC entry 219 (class 1259 OID 16415)
-- Name: processing_queue; Type: TABLE; Schema: public; Owner: shelbyklein
--

CREATE TABLE public.processing_queue (
    id integer NOT NULL,
    photo_id integer,
    status character varying(50) DEFAULT 'pending'::character varying,
    priority integer DEFAULT 0,
    attempts integer DEFAULT 0,
    last_error text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);


ALTER TABLE public.processing_queue OWNER TO shelbyklein;

--
-- TOC entry 218 (class 1259 OID 16414)
-- Name: processing_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: shelbyklein
--

CREATE SEQUENCE public.processing_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.processing_queue_id_seq OWNER TO shelbyklein;

--
-- TOC entry 3929 (class 0 OID 0)
-- Dependencies: 218
-- Name: processing_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: shelbyklein
--

ALTER SEQUENCE public.processing_queue_id_seq OWNED BY public.processing_queue.id;


--
-- TOC entry 225 (class 1259 OID 16505)
-- Name: sync_jobs; Type: TABLE; Schema: public; Owner: shelbyklein
--

CREATE TABLE public.sync_jobs (
    id integer NOT NULL,
    job_id character varying(100) NOT NULL,
    album_key character varying(255) NOT NULL,
    status character varying(50),
    progress_stage character varying(100),
    progress_percent integer,
    total_photos integer,
    processed_photos integer,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);


ALTER TABLE public.sync_jobs OWNER TO shelbyklein;

--
-- TOC entry 224 (class 1259 OID 16504)
-- Name: sync_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: shelbyklein
--

CREATE SEQUENCE public.sync_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sync_jobs_id_seq OWNER TO shelbyklein;

--
-- TOC entry 3930 (class 0 OID 0)
-- Dependencies: 224
-- Name: sync_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: shelbyklein
--

ALTER SEQUENCE public.sync_jobs_id_seq OWNED BY public.sync_jobs.id;


--
-- TOC entry 3698 (class 2604 OID 16448)
-- Name: ai_metadata id; Type: DEFAULT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.ai_metadata ALTER COLUMN id SET DEFAULT nextval('public.ai_metadata_id_seq'::regclass);


--
-- TOC entry 3701 (class 2604 OID 16496)
-- Name: album_cache id; Type: DEFAULT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.album_cache ALTER COLUMN id SET DEFAULT nextval('public.album_cache_id_seq'::regclass);


--
-- TOC entry 3705 (class 2604 OID 16645)
-- Name: albums id; Type: DEFAULT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.albums ALTER COLUMN id SET DEFAULT nextval('public.albums_id_seq'::regclass);


--
-- TOC entry 3713 (class 2604 OID 16682)
-- Name: collection_items id; Type: DEFAULT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.collection_items ALTER COLUMN id SET DEFAULT nextval('public.collection_items_id_seq'::regclass);


--
-- TOC entry 3711 (class 2604 OID 16667)
-- Name: collections id; Type: DEFAULT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);


--
-- TOC entry 3689 (class 2604 OID 16406)
-- Name: oauth_tokens id; Type: DEFAULT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.oauth_tokens ALTER COLUMN id SET DEFAULT nextval('public.oauth_tokens_id_seq'::regclass);


--
-- TOC entry 3685 (class 2604 OID 16393)
-- Name: photos id; Type: DEFAULT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.photos ALTER COLUMN id SET DEFAULT nextval('public.photos_id_seq'::regclass);


--
-- TOC entry 3693 (class 2604 OID 16418)
-- Name: processing_queue id; Type: DEFAULT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.processing_queue ALTER COLUMN id SET DEFAULT nextval('public.processing_queue_id_seq'::regclass);


--
-- TOC entry 3703 (class 2604 OID 16508)
-- Name: sync_jobs id; Type: DEFAULT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.sync_jobs ALTER COLUMN id SET DEFAULT nextval('public.sync_jobs_id_seq'::regclass);


--
-- TOC entry 3735 (class 2606 OID 16456)
-- Name: ai_metadata ai_metadata_photo_id_key; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.ai_metadata
    ADD CONSTRAINT ai_metadata_photo_id_key UNIQUE (photo_id);


--
-- TOC entry 3737 (class 2606 OID 16454)
-- Name: ai_metadata ai_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.ai_metadata
    ADD CONSTRAINT ai_metadata_pkey PRIMARY KEY (id);


--
-- TOC entry 3742 (class 2606 OID 16501)
-- Name: album_cache album_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.album_cache
    ADD CONSTRAINT album_cache_pkey PRIMARY KEY (id);


--
-- TOC entry 3751 (class 2606 OID 16654)
-- Name: albums albums_pkey; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.albums
    ADD CONSTRAINT albums_pkey PRIMARY KEY (id);


--
-- TOC entry 3753 (class 2606 OID 16656)
-- Name: albums albums_smugmug_id_key; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.albums
    ADD CONSTRAINT albums_smugmug_id_key UNIQUE (smugmug_id);


--
-- TOC entry 3760 (class 2606 OID 16685)
-- Name: collection_items collection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3757 (class 2606 OID 16672)
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- TOC entry 3727 (class 2606 OID 16413)
-- Name: oauth_tokens oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3723 (class 2606 OID 16399)
-- Name: photos photos_pkey; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);


--
-- TOC entry 3725 (class 2606 OID 16401)
-- Name: photos photos_smugmug_id_key; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_smugmug_id_key UNIQUE (smugmug_id);


--
-- TOC entry 3731 (class 2606 OID 16428)
-- Name: processing_queue processing_queue_photo_id_key; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.processing_queue
    ADD CONSTRAINT processing_queue_photo_id_key UNIQUE (photo_id);


--
-- TOC entry 3733 (class 2606 OID 16426)
-- Name: processing_queue processing_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.processing_queue
    ADD CONSTRAINT processing_queue_pkey PRIMARY KEY (id);


--
-- TOC entry 3749 (class 2606 OID 16513)
-- Name: sync_jobs sync_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.sync_jobs
    ADD CONSTRAINT sync_jobs_pkey PRIMARY KEY (id);


--
-- TOC entry 3764 (class 2606 OID 16687)
-- Name: collection_items unique_collection_photo; Type: CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT unique_collection_photo UNIQUE (collection_id, photo_id);


--
-- TOC entry 3738 (class 1259 OID 16463)
-- Name: idx_ai_metadata_approved; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_ai_metadata_approved ON public.ai_metadata USING btree (approved);


--
-- TOC entry 3739 (class 1259 OID 16462)
-- Name: idx_ai_metadata_photo_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_ai_metadata_photo_id ON public.ai_metadata USING btree (photo_id);


--
-- TOC entry 3740 (class 1259 OID 16464)
-- Name: idx_ai_metadata_processed_at; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_ai_metadata_processed_at ON public.ai_metadata USING btree (processed_at DESC);


--
-- TOC entry 3754 (class 1259 OID 16698)
-- Name: idx_albums_smugmug_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_albums_smugmug_id ON public.albums USING btree (smugmug_id);


--
-- TOC entry 3755 (class 1259 OID 16699)
-- Name: idx_albums_title; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_albums_title ON public.albums USING btree (title);


--
-- TOC entry 3761 (class 1259 OID 16703)
-- Name: idx_collection_items_collection_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_collection_items_collection_id ON public.collection_items USING btree (collection_id);


--
-- TOC entry 3762 (class 1259 OID 16704)
-- Name: idx_collection_items_photo_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_collection_items_photo_id ON public.collection_items USING btree (photo_id);


--
-- TOC entry 3758 (class 1259 OID 16702)
-- Name: idx_collections_name; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_collections_name ON public.collections USING btree (name);


--
-- TOC entry 3715 (class 1259 OID 16700)
-- Name: idx_photos_album_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_photos_album_id ON public.photos USING btree (album_id);


--
-- TOC entry 3716 (class 1259 OID 16435)
-- Name: idx_photos_album_name; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_photos_album_name ON public.photos USING btree (album_name);


--
-- TOC entry 3717 (class 1259 OID 16440)
-- Name: idx_photos_caption_gin; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_photos_caption_gin ON public.photos USING gin (to_tsvector('english'::regconfig, caption));


--
-- TOC entry 3718 (class 1259 OID 16436)
-- Name: idx_photos_created_at; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_photos_created_at ON public.photos USING btree (created_at DESC);


--
-- TOC entry 3719 (class 1259 OID 16701)
-- Name: idx_photos_processing_status; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_photos_processing_status ON public.photos USING btree (processing_status);


--
-- TOC entry 3720 (class 1259 OID 16434)
-- Name: idx_photos_smugmug_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_photos_smugmug_id ON public.photos USING btree (smugmug_id);


--
-- TOC entry 3721 (class 1259 OID 16439)
-- Name: idx_photos_title_gin; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_photos_title_gin ON public.photos USING gin (to_tsvector('english'::regconfig, (title)::text));


--
-- TOC entry 3728 (class 1259 OID 16438)
-- Name: idx_processing_queue_photo_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_processing_queue_photo_id ON public.processing_queue USING btree (photo_id);


--
-- TOC entry 3729 (class 1259 OID 16437)
-- Name: idx_processing_queue_status; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX idx_processing_queue_status ON public.processing_queue USING btree (status);


--
-- TOC entry 3743 (class 1259 OID 16502)
-- Name: ix_album_cache_cache_key; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE UNIQUE INDEX ix_album_cache_cache_key ON public.album_cache USING btree (cache_key);


--
-- TOC entry 3744 (class 1259 OID 16503)
-- Name: ix_album_cache_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX ix_album_cache_id ON public.album_cache USING btree (id);


--
-- TOC entry 3745 (class 1259 OID 16515)
-- Name: ix_sync_jobs_album_key; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX ix_sync_jobs_album_key ON public.sync_jobs USING btree (album_key);


--
-- TOC entry 3746 (class 1259 OID 16514)
-- Name: ix_sync_jobs_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE INDEX ix_sync_jobs_id ON public.sync_jobs USING btree (id);


--
-- TOC entry 3747 (class 1259 OID 16516)
-- Name: ix_sync_jobs_job_id; Type: INDEX; Schema: public; Owner: shelbyklein
--

CREATE UNIQUE INDEX ix_sync_jobs_job_id ON public.sync_jobs USING btree (job_id);


--
-- TOC entry 3773 (class 2620 OID 16705)
-- Name: albums update_albums_updated_at; Type: TRIGGER; Schema: public; Owner: shelbyklein
--

CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON public.albums FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3774 (class 2620 OID 16706)
-- Name: collections update_collections_updated_at; Type: TRIGGER; Schema: public; Owner: shelbyklein
--

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3772 (class 2620 OID 16443)
-- Name: oauth_tokens update_oauth_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: shelbyklein
--

CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON public.oauth_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3771 (class 2620 OID 16442)
-- Name: photos update_photos_updated_at; Type: TRIGGER; Schema: public; Owner: shelbyklein
--

CREATE TRIGGER update_photos_updated_at BEFORE UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3767 (class 2606 OID 16457)
-- Name: ai_metadata ai_metadata_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.ai_metadata
    ADD CONSTRAINT ai_metadata_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE CASCADE;


--
-- TOC entry 3769 (class 2606 OID 16688)
-- Name: collection_items collection_items_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- TOC entry 3770 (class 2606 OID 16693)
-- Name: collection_items collection_items_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE CASCADE;


--
-- TOC entry 3768 (class 2606 OID 16673)
-- Name: collections collections_cover_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_cover_photo_id_fkey FOREIGN KEY (cover_photo_id) REFERENCES public.photos(id);


--
-- TOC entry 3765 (class 2606 OID 16657)
-- Name: photos photos_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albums(id);


--
-- TOC entry 3766 (class 2606 OID 16429)
-- Name: processing_queue processing_queue_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shelbyklein
--

ALTER TABLE ONLY public.processing_queue
    ADD CONSTRAINT processing_queue_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE CASCADE;


-- Completed on 2025-08-11 16:59:03 EDT

--
-- PostgreSQL database dump complete
--

