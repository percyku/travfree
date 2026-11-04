package com.percyku.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import com.percyku.backend.entity.Product;

public interface ProductRepository extends JpaRepository<Product, String> {

	Page<Product> findByCategory(String category, Pageable pageable);

	Page<Product> findByEnabledTrue(Pageable pageable);

	Page<Product> findByEnabledTrueAndCategory(String category, Pageable pageable);

	List<Product> findByEnabledTrue(Sort sort);

	Optional<Product> findByIdAndEnabledTrue(String id);
}
