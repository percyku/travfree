package com.percyku.backend.entity;

import java.util.ArrayList;
import java.util.List;

import com.percyku.backend.dto.OrderUser;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "orders")
public class Order extends BaseEntity {

	/**
	 * 下單的帳號。user_name、user_email 等欄位是收件資料，可以與帳號不同，不能用來判斷訂單屬於誰。
	 * 會員系統之前的訂單是 null。
	 */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id")
	private User buyer;

	@Column(name = "user_name", nullable = false)
	private String userName;

	@Column(name = "user_email", nullable = false)
	private String userEmail;

	@Column(name = "user_tel", nullable = false)
	private String userTel;

	@Column(name = "user_address", nullable = false)
	private String userAddress;

	@Column(columnDefinition = "text")
	private String message;

	/** 折扣後總額。 */
	@Column(nullable = false)
	private long total;

	@Column(name = "is_paid", nullable = false)
	private boolean paid;

	/** 付款時間，Unix 秒；未付款時為 null。 */
	@Column(name = "paid_date")
	private Long paidDate;

	/** 外送進度：0 未確認、1 已確認、2 外送中、3 已送達。 */
	@Column(nullable = false)
	private int status;

	/** 建立時間，Unix 秒。 */
	@Column(name = "create_at", nullable = false, updatable = false)
	private long createAt;

	@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("sortOrder")
	private List<OrderItem> items = new ArrayList<>();

	protected Order() {
	}

	public Order(User buyer, OrderUser user, String message, long createAt) {
		this.buyer = buyer;
		this.userName = user.name();
		this.userEmail = user.email();
		this.userTel = user.tel();
		this.userAddress = user.address();
		this.message = message;
		this.createAt = createAt;
	}

	public void addItem(OrderItem item) {
		items.add(item);
		total += item.getFinalTotal();
	}

	/** 付款時間由伺服器決定，否則後台勾選已付款時列表仍會顯示「未付款」。 */
	public void updatePaid(boolean paid, long now) {
		if (paid && !this.paid) {
			paidDate = now;
		} else if (!paid) {
			paidDate = null;
		}
		this.paid = paid;
	}

	public void setStatus(int status) {
		this.status = status;
	}

	public User getBuyer() {
		return buyer;
	}

	public String getUserName() {
		return userName;
	}

	public String getUserEmail() {
		return userEmail;
	}

	public String getUserTel() {
		return userTel;
	}

	public String getUserAddress() {
		return userAddress;
	}

	public String getMessage() {
		return message;
	}

	public long getTotal() {
		return total;
	}

	public boolean isPaid() {
		return paid;
	}

	public Long getPaidDate() {
		return paidDate;
	}

	public int getStatus() {
		return status;
	}

	public long getCreateAt() {
		return createAt;
	}

	public List<OrderItem> getItems() {
		return items;
	}
}
