package com.percyku.backend.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.percyku.backend.entity.Article;

public interface ArticleRepository extends JpaRepository<Article, String> {

	Page<Article> findByPublicArticleTrue(Pageable pageable);

	Optional<Article> findByIdAndPublicArticleTrue(String id);
}
