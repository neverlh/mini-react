import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'

// function App() {
// 	const [num, setNum] = useState(100)

// 	const arr =
// 		num % 2 === 0
// 			? [
// 					<li key="1"></li>,
// 					<li key="2">2</li>,
// 					<li key="3">3</li>,
// 					<>
// 						<div>7</div>
// 						<div>8</div>
// 					</>
// 			  ]
// 			: [
// 					<li key="3">3</li>,
// 					<li key="2">2</li>,
// 					<li key="1">1</li>,
// 					<>
// 						<div>7</div>
// 						<div>8</div>
// 					</>
// 			  ]

// 	return (
// 		<>
// 			<ul onClickCapture={() => setNum(num + 1)}>
// 				<li>4</li>
// 				<li>5</li>
// 				{arr}
// 			</ul>
// 			{num % 2 === 0 ? <>9</> : <>10</>}
// 		</>
// 	)
// }

// function Child() {
// 	return <span>mini-react</span>
// }

// function App() {
// 	const [num, setNum] = useState(100)

// 	return (
// 		<ul
// 			onClickCapture={() => {
// 				setNum((num) => num + 1)
// 				setNum((num) => num + 1)
// 				setNum((num) => num + 1)
// 			}}
// 		>
// 			{num}
// 		</ul>
// 	)
// }

function App() {
	const [num, updateNum] = useState(0)
	useEffect(() => {
		console.log('App mount')
	}, [])

	useEffect(() => {
		console.log('App update')
	})

	useEffect(() => {
		console.log('num change create', num)
		return () => {
			console.log('num change destroy', num)
		}
	}, [num])

	return (
		<div onClick={() => updateNum(num + 1)}>
			{num === 0 ? <Child num={num} /> : 'noop'}
		</div>
	)
}

function Child({ num }) {
	useEffect(() => {
		console.log('Child mount')
		return () => console.log('Child unmount')
	}, [])

	useEffect(() => {
		return () => console.log('Child unmount', num)
	}, [num])

	return 'i am child'
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
