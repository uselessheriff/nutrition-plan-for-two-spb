// Store departments are presentation metadata only: never change recipe needs or payments.
export const shoppingDepartments = [
 {id:'produce',label:'Овощи, фрукты и зелень',products:['eggplant','carrot','tomato','cucumber','spinach','potato','onion','cabbage','pepper','zucchini','mushrooms','garlic','apple','banana']},
 {id:'bakery',label:'Хлеб и лаваш',products:['bread','pita']},
 {id:'grocery',label:'Крупы, макароны и бакалея',products:['oats','couscous','rice','bulgur','semolina','millet','pasta','buckwheat','nuts','oil','flour','sugar','salt','spices']},
 {id:'canned',label:'Консервы, соусы и варенье',products:['tuna','pickles','marinated','passata','jam','mustard','lemon']},
 {id:'drinks',label:'Соки и напитки',products:['juice']},
 {id:'meat-fish',label:'Мясо, птица и рыба',products:['chicken','pork','beef','mince','turkey','liver','fish','salmon','porkmince','mixedmince']},
 {id:'dairy',label:'Молочные продукты, сыр и яйца',products:['egg','yogurt','cheese','feta','butter','curd','milk','sourcream','bar']},
 {id:'frozen',label:'Заморозка и тесто',products:['broccoli','shrimp','berries','dough']},
 {id:'other',label:'Остальное',products:[]}
];
export function shoppingDepartment(id){
 return shoppingDepartments.find(group=>group.products.includes(id))||shoppingDepartments.at(-1);
}
export function groupShoppingRows(rows,nameOf=id=>id){
 return shoppingDepartments.map(group=>{
  const items=rows.filter(row=>row.purchase>0&&shoppingDepartment(row.id).id===group.id)
   .sort((a,b)=>nameOf(a.id).localeCompare(nameOf(b.id),'ru'));
  return {id:group.id,label:group.label,rows:items,total:items.reduce((sum,row)=>sum+Math.round(row.cost*100),0)/100};
 }).filter(group=>group.rows.length>0);
}
