package com.percyku.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.percyku.backend.entity.Order;

public interface OrderRepository extends JpaRepository<Order, String> {
}
